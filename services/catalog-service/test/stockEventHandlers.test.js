const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createStockEventHandlers } = require('../src/events/stockEventHandlers');
const { aggregateItems } = require('../src/services/stockService');
const { canTransition, SAGA_STATUS } = require('../src/models/StockReservation');

const orderId = '6f1c3b1e-8a43-4e57-9d0a-1b2c3d4e5f60';
const userId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

function saga(status, reason) {
  return {
    orderId,
    userId,
    totalAmount: 699.8,
    status,
    reason,
    items: [{ productId: '65a000000000000000000001', quantity: 2 }],
  };
}

function setup(sagaResult) {
  const sent = [];
  const producer = { send: async (payload) => { sent.push(payload); } };
  const stockService = { reserveForOrder: async () => sagaResult };
  const handlers = createStockEventHandlers({ stockService, producer });
  return { sent, handle: handlers['order.created'].handle };
}

test('reserva concluída publica STOCK_RESERVED com userId e totalAmount repassados', async () => {
  const { sent, handle } = setup(saga(SAGA_STATUS.RESERVED));
  await handle({ orderId });

  assert.equal(sent.length, 1);
  assert.equal(sent[0].topic, 'stock.reserved');
  const message = sent[0].messages[0];
  assert.equal(message.key, orderId);
  const event = JSON.parse(message.value);
  assert.equal(event.eventType, 'STOCK_RESERVED');
  assert.equal(event.orderId, orderId);
  assert.equal(event.userId, userId);
  assert.equal(event.totalAmount, 699.8);
  assert.deepEqual(event.items, [{ productId: '65a000000000000000000001', quantity: 2 }]);
  assert.match(event.eventId, /^[0-9a-f-]{36}$/);
  assert.match(event.occurredAt, /Z$/);
});

test('reserva rejeitada publica STOCK_REJECTED com o motivo', async () => {
  const reason = 'Estoque insuficiente para Teclado Mecanico (solicitado: 20, disponível: 15)';
  const { sent, handle } = setup(saga(SAGA_STATUS.REJECTED, reason));
  await handle({ orderId });

  assert.equal(sent[0].topic, 'stock.rejected');
  const event = JSON.parse(sent[0].messages[0].value);
  assert.equal(event.eventType, 'STOCK_REJECTED');
  assert.equal(event.reason, reason);
  assert.equal(event.userId, userId);
});

test('Saga já finalizada não publica novamente', async () => {
  const { sent, handle } = setup(saga(SAGA_STATUS.COMMITTED));
  await handle({ orderId });
  assert.equal(sent.length, 0);
});

test('itens repetidos do mesmo produto são somados', () => {
  assert.deepEqual(aggregateItems([
    { productId: 'a', quantity: 2 },
    { productId: 'b', quantity: 1 },
    { productId: 'a', quantity: 3 },
  ]), [
    { productId: 'a', quantity: 5 },
    { productId: 'b', quantity: 1 },
  ]);
});

test('transições da Saga seguem o contrato', () => {
  assert.equal(canTransition(SAGA_STATUS.PROCESSING, SAGA_STATUS.RESERVED), true);
  assert.equal(canTransition(SAGA_STATUS.PROCESSING, SAGA_STATUS.REJECTED), true);
  assert.equal(canTransition(SAGA_STATUS.RESERVED, SAGA_STATUS.COMMITTED), true);
  assert.equal(canTransition(SAGA_STATUS.RESERVED, SAGA_STATUS.RELEASED), true);
  assert.equal(canTransition(SAGA_STATUS.PROCESSING, SAGA_STATUS.COMMITTED), false);
  assert.equal(canTransition(SAGA_STATUS.REJECTED, SAGA_STATUS.RELEASED), false);
  assert.equal(canTransition(SAGA_STATUS.COMMITTED, SAGA_STATUS.RELEASED), false);
  assert.equal(canTransition(SAGA_STATUS.RELEASED, SAGA_STATUS.COMMITTED), false);
});
