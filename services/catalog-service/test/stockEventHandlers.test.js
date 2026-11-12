const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createStockEventHandlers } = require('../src/events/stockEventHandlers');
const { CONSUMED_TOPICS, DECLARED_TOPICS } = require('../src/events/topics');
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

const commandBase = {
  eventId: 'b1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  occurredAt: '2026-10-07T03:20:06.021Z',
  orderId,
  userId,
};

function setupCommands() {
  const calls = [];
  const stockService = {
    commitForOrder: async (event) => { calls.push(['commit', event.orderId]); },
    releaseForOrder: async (event) => { calls.push(['release', event.orderId]); },
  };
  const handlers = createStockEventHandlers({ stockService, producer: { send: async () => {} } });
  return { calls, handlers };
}

test('stock.commit efetiva a reserva do pedido', async () => {
  const { calls, handlers } = setupCommands();
  const { schema, handle } = handlers['stock.commit'];

  const event = schema.parse({ ...commandBase, eventType: 'STOCK_COMMIT_REQUESTED' });
  await handle(event);

  assert.deepEqual(calls, [['commit', orderId]]);
});

test('stock.release libera a reserva do pedido', async () => {
  const { calls, handlers } = setupCommands();
  const { schema, handle } = handlers['stock.release'];

  const event = schema.parse({ ...commandBase, eventType: 'STOCK_RELEASE_REQUESTED', reason: null });
  await handle(event);

  assert.deepEqual(calls, [['release', orderId]]);
});

test('schemas dos comandos validam eventType, userId e reason', () => {
  const { handlers } = setupCommands();
  const commit = handlers['stock.commit'].schema;
  const release = handlers['stock.release'].schema;

  assert.equal(commit.safeParse({ ...commandBase, eventType: 'STOCK_COMMIT_REQUESTED', extra: 1 }).success, true);
  assert.equal(commit.safeParse({ ...commandBase, eventType: 'STOCK_RELEASE_REQUESTED' }).success, false);
  assert.equal(commit.safeParse({ ...commandBase, eventType: 'STOCK_COMMIT_REQUESTED', userId: 'x' }).success, false);
  assert.equal(commit.safeParse({ ...commandBase, eventType: 'STOCK_COMMIT_REQUESTED', orderId: undefined }).success, false);

  const base = { ...commandBase, eventType: 'STOCK_RELEASE_REQUESTED' };
  assert.equal(release.safeParse(base).success, true);
  assert.equal(release.safeParse({ ...base, reason: 'Pagamento recusado' }).success, true);
  assert.equal(release.safeParse({ ...base, reason: null }).success, true);
  assert.equal(release.safeParse({ ...base, reason: 42 }).success, false);
  assert.equal(release.safeParse({ ...base, eventType: 'ORDER_CANCELLED' }).success, false);
});

test('Catalog assina order.created e comandos de estoque, não mais payment.* nem order.cancelled', () => {
  assert.deepEqual(CONSUMED_TOPICS, ['order.created', 'stock.commit', 'stock.release']);

  for (const topic of ['payment.approved', 'payment.rejected', 'order.cancelled']) {
    assert.equal(CONSUMED_TOPICS.includes(topic), false);
    assert.equal(DECLARED_TOPICS.includes(topic), false);
  }
  for (const topic of CONSUMED_TOPICS) {
    assert.ok(DECLARED_TOPICS.includes(`${topic}.DLT`));
  }
  assert.ok(DECLARED_TOPICS.includes('stock.reserved'));
  assert.ok(DECLARED_TOPICS.includes('stock.rejected'));

  const { handlers } = setupCommands();
  assert.deepEqual(Object.keys(handlers).sort(), [...CONSUMED_TOPICS].sort());
});
