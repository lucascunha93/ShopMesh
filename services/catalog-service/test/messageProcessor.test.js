const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createMessageProcessor } = require('../src/events/messageProcessor');
const { orderCreatedSchema } = require('../src/events/schemas');

const validEvent = {
  eventId: '0b8f6c7e-2f7b-4f6e-9a9c-3f0b7f1a1a11',
  eventType: 'ORDER_CREATED',
  occurredAt: '2026-10-07T03:20:06.021Z',
  orderId: '6f1c3b1e-8a43-4e57-9d0a-1b2c3d4e5f60',
  userId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  totalAmount: 699.8,
  items: [{ productId: '65a000000000000000000001', quantity: 2, unitPrice: 349.9 }],
  campoNovo: 'ignorado',
};

function record(value) {
  return {
    topic: 'order.created',
    partition: 1,
    message: {
      key: Buffer.from(validEvent.orderId),
      value: Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)),
      offset: '42',
      headers: {},
    },
  };
}

function fakeProducer() {
  const sent = [];
  return { sent, send: async (payload) => { sent.push(payload); } };
}

function processorWith(handle, producer, sleepCalls = []) {
  return createMessageProcessor({
    handlers: { 'order.created': { schema: orderCreatedSchema, handle } },
    producer,
    sleep: async (ms) => { sleepCalls.push(ms); },
  });
}

test('evento válido é entregue ao handler sem campos desconhecidos', async () => {
  const producer = fakeProducer();
  const received = [];
  await processorWith(async (event) => { received.push(event); }, producer)(record(validEvent));

  assert.equal(received.length, 1);
  assert.equal(received[0].orderId, validEvent.orderId);
  assert.equal('campoNovo' in received[0], false);
  assert.equal(producer.sent.length, 0);
});

test('JSON malformado vai direto para a DLT, sem tentativas', async () => {
  const producer = fakeProducer();
  let calls = 0;
  await processorWith(async () => { calls += 1; }, producer)(record('{nao-e-json'));

  assert.equal(calls, 0);
  assert.equal(producer.sent.length, 1);
  assert.equal(producer.sent[0].topic, 'order.created.DLT');
  const { headers, key } = producer.sent[0].messages[0];
  assert.equal(headers['x-rejected-by'], 'catalog-service');
  assert.equal(headers['x-error-type'], 'INVALID_EVENT');
  assert.equal(key.toString(), validEvent.orderId);
});

test('campo obrigatório ausente vai direto para a DLT', async () => {
  const producer = fakeProducer();
  const { userId, ...withoutUser } = validEvent;
  let calls = 0;
  await processorWith(async () => { calls += 1; }, producer)(record(withoutUser));

  assert.equal(userId.length > 0, true);
  assert.equal(calls, 0);
  assert.equal(producer.sent[0].topic, 'order.created.DLT');
});

test('falha de processamento é tentada três vezes e depois vai para a DLT', async () => {
  const producer = fakeProducer();
  const sleeps = [];
  let calls = 0;
  await processorWith(async () => {
    calls += 1;
    throw new Error('Mongo indisponível');
  }, producer, sleeps)(record(validEvent));

  assert.equal(calls, 3);
  assert.deepEqual(sleeps, [1000, 1000]);
  assert.equal(producer.sent.length, 1);
  const { headers } = producer.sent[0].messages[0];
  assert.equal(headers['x-error-type'], 'PROCESSING_FAILED');
  assert.equal(headers['x-attempts'], '3');
});

test('falha temporária se recupera em nova tentativa', async () => {
  const producer = fakeProducer();
  let calls = 0;
  await processorWith(async () => {
    calls += 1;
    if (calls === 1) {
      throw new Error('instabilidade');
    }
  }, producer)(record(validEvent));

  assert.equal(calls, 2);
  assert.equal(producer.sent.length, 0);
});

test('falha ao publicar na DLT é propagada para não confirmar o offset', async () => {
  const producer = { send: async () => { throw new Error('broker fora'); } };
  await assert.rejects(processorWith(async () => {}, producer)(record('{')), /broker fora/);
});
