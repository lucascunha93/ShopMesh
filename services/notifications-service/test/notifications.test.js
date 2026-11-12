const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { createApp } = require('../src/app');
const { createMemoryNotificationStore } = require('../src/store/notificationStore');
const { createMongoNotificationStore, NOTIFICATION_TTL_SECONDS } = require('../src/store/mongoNotificationStore');
const { createNotificationHandlers } = require('../src/events/notificationHandlers');
const { CONSUMED_TOPICS, DECLARED_TOPICS } = require('../src/events/topics');

const SECRET = 'test-secret-with-at-least-thirty-two-characters';
const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';
const orderId = '6f1c3b1e-8a43-4e57-9d0a-1b2c3d4e5f60';

function orderConfirmed(eventId, userId = userA) {
  return {
    eventId,
    eventType: 'ORDER_CONFIRMED',
    occurredAt: '2026-10-07T03:20:06.021Z',
    orderId,
    userId,
    totalAmount: 699.8,
  };
}

let server;
let baseUrl;
const store = createMemoryNotificationStore({ maxSize: 3 });
const handlers = createNotificationHandlers({ store });

before(async () => {
  process.env.JWT_SECRET = SECRET;
  server = createApp({ store }).listen(0);
  await new Promise((resolve) => { server.once('listening', resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
});

function token(sub, role = 'CUSTOMER') {
  return jwt.sign({ role }, SECRET, { subject: sub, expiresIn: '5m' });
}

test('pedido confirmado gera notificação com o valor total e duplicatas são ignoradas', async () => {
  const { schema, handle } = handlers['order.confirmed'];
  const event = schema.parse({
    ...orderConfirmed('44444444-4444-4444-8444-444444444444'),
    campoDesconhecido: true,
  });
  await handle(event);
  await handle(event);

  const [notification, ...rest] = await store.list({ userId: userA });
  assert.equal(rest.length, 0);
  assert.equal(notification.type, 'ORDER_CONFIRMED');
  assert.equal(notification.title, 'Pedido confirmado');
  assert.match(notification.message, /#6f1c3b1e/);
  assert.match(notification.message, /699,80/);

  assert.equal(schema.safeParse({ ...event, eventType: 'PAYMENT_APPROVED' }).success, false);
  assert.equal(schema.safeParse({ ...event, totalAmount: undefined }).success, false);
});

test('estoque rejeitado inclui o motivo', async () => {
  await handlers['stock.rejected'].handle({
    eventId: '55555555-5555-4555-8555-555555555555',
    eventType: 'STOCK_REJECTED',
    occurredAt: '2026-10-07T03:20:06.021Z',
    orderId,
    userId: userB,
    reason: 'Estoque insuficiente para Café (solicitado: 5, disponível: 1)',
  });

  const [notification] = await store.list({ userId: userB });
  assert.equal(notification.type, 'ORDER_CANCELLED');
  assert.match(notification.message, /Estoque insuficiente para Café/);
});

test('cancelamento manual do pedido notifica o cliente', async () => {
  const isolatedStore = createMemoryNotificationStore({ maxSize: 5 });
  const isolated = createNotificationHandlers({ store: isolatedStore });
  const { schema, handle } = isolated['order.cancelled'];

  await handle(schema.parse({
    eventId: '66666666-6666-4666-8666-666666666666',
    eventType: 'ORDER_CANCELLED',
    occurredAt: '2026-10-07T03:20:06.021Z',
    orderId,
    userId: userA,
    reason: null,
  }));

  const [notification] = await isolatedStore.list({ userId: userA });
  assert.equal(notification.type, 'ORDER_CANCELLED');
  assert.match(notification.message, /#6f1c3b1e.*cancelado/);
});

test('store descarta as notificações mais antigas acima do limite', async () => {
  const small = createMemoryNotificationStore({ maxSize: 2 });
  assert.equal(await small.add({ eventId: 'a', userId: userA }), true);
  await small.add({ eventId: 'b', userId: userA });
  await small.add({ eventId: 'c', userId: userA });
  assert.deepEqual((await small.list()).map((n) => n.eventId), ['c', 'b']);
  assert.equal(await small.add({ eventId: 'a', userId: userA }), true);
  assert.equal(await small.add({ eventId: 'a', userId: userA }), false);
});

test('store em memória respeita filtro de usuário e limite', async () => {
  const memory = createMemoryNotificationStore();
  await memory.add({ eventId: '1', userId: userA });
  await memory.add({ eventId: '2', userId: userB });
  await memory.add({ eventId: '3', userId: userA });
  assert.equal(memory.type, 'memory');
  assert.deepEqual((await memory.list({ userId: userA })).map((n) => n.eventId), ['3', '1']);
  assert.deepEqual((await memory.list({ limit: 2 })).map((n) => n.eventId), ['3', '2']);
});

test('store Mongo converte duplicata em false, repassa outros erros e serializa a data', async () => {
  const created = [];
  let failWith = null;
  const query = (documents) => {
    const chain = {
      sort: (sort) => { chain.sortArg = sort; return chain; },
      limit: (limit) => { chain.limitArg = limit; return chain; },
      lean: async () => documents,
    };
    return chain;
  };
  const Model = {
    create: async (doc) => {
      if (failWith) {
        throw failWith;
      }
      created.push(doc);
    },
    find: (filter) => {
      Model.lastFilter = filter;
      return query([{ _id: 'x', eventId: 'e1', userId: userA, createdAt: new Date('2026-10-07T03:20:06.021Z') }]);
    },
  };
  const mongoStore = createMongoNotificationStore({ mongoUri: 'mongodb://unused', Model });

  assert.equal(mongoStore.type, 'mongo');
  assert.equal(await mongoStore.add({ eventId: 'e1', userId: userA, createdAt: '2026-10-07T03:20:06.021Z' }), true);
  assert.ok(created[0].createdAt instanceof Date);

  failWith = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
  assert.equal(await mongoStore.add({ eventId: 'e1', userId: userA, createdAt: '2026-10-07T03:20:06.021Z' }), false);

  failWith = new Error('conexão perdida');
  await assert.rejects(() => mongoStore.add({ eventId: 'e2', userId: userA, createdAt: '2026-10-07T03:20:06.021Z' }));

  const [item] = await mongoStore.list({ userId: userA, limit: 5 });
  assert.deepEqual(Model.lastFilter, { userId: userA });
  assert.equal(item.createdAt, '2026-10-07T03:20:06.021Z');
  assert.equal('_id' in item, false);
});

test('schema do Mongo define índice único em eventId, índice por usuário e TTL de 30 dias', () => {
  const mongoose = require('mongoose');
  const indexes = mongoose.model('Notification').schema.indexes();
  const find = (key) => indexes.find(([fields]) => JSON.stringify(fields) === JSON.stringify(key));

  assert.equal(find({ eventId: 1 })[1].unique, true);
  assert.ok(find({ userId: 1, createdAt: -1 }));
  assert.equal(find({ createdAt: 1 })[1].expireAfterSeconds, NOTIFICATION_TTL_SECONDS);
  assert.equal(NOTIFICATION_TTL_SECONDS, 30 * 24 * 60 * 60);
});

test('pagamento estornado gera notificação com valor e pedido', async () => {
  const isolatedStore = createMemoryNotificationStore();
  const { schema, handle } = createNotificationHandlers({ store: isolatedStore })['payment.refunded'];

  const event = schema.parse({
    eventId: '77777777-7777-4777-8777-777777777777',
    eventType: 'PAYMENT_REFUNDED',
    occurredAt: '2026-10-07T03:20:06.021Z',
    orderId,
    paymentId: '33333333-3333-4333-8333-333333333333',
    userId: userA,
    amount: 699.8,
    reason: 'Pedido cancelado',
    campoDesconhecido: true,
  });
  await handle(event);

  const [notification] = await isolatedStore.list({ userId: userA });
  assert.equal(notification.type, 'PAYMENT_REFUNDED');
  assert.equal(notification.title, 'Pagamento estornado');
  assert.match(notification.message, /699,80/);
  assert.match(notification.message, /#6f1c3b1e/);
  assert.match(notification.message, /Pedido cancelado/);

  assert.equal(schema.safeParse({ ...event, eventType: 'PAYMENT_REJECTED' }).success, false);
  assert.equal(schema.safeParse({ ...event, reason: null }).success, true);
  assert.equal(schema.safeParse({ ...event, amount: '10' }).success, false);
});

test('serviço consome order.confirmed e payment.refunded, mas não mais payment.approved', () => {
  assert.deepEqual([...CONSUMED_TOPICS].sort(), [
    'order.cancelled',
    'order.confirmed',
    'order.created',
    'payment.refunded',
    'payment.rejected',
    'stock.rejected',
  ]);
  assert.equal(DECLARED_TOPICS.includes('payment.approved'), false);
  assert.equal(DECLARED_TOPICS.includes('payment.approved.DLT'), false);
  for (const topic of CONSUMED_TOPICS) {
    assert.ok(DECLARED_TOPICS.includes(`${topic}.DLT`));
  }
  assert.deepEqual(Object.keys(handlers).sort(), [...CONSUMED_TOPICS].sort());
});

test('GET /notifications/me exige token e filtra pelo usuário', async () => {
  const unauthenticated = await fetch(`${baseUrl}/notifications/me`);
  assert.equal(unauthenticated.status, 401);

  const response = await fetch(`${baseUrl}/notifications/me`, {
    headers: { Authorization: `Bearer ${token(userB)}` },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(body.items.length >= 1);
  assert.ok(body.items.every((notification) => notification.userId === userB));
});

test('GET /notifications é restrito a ADMIN', async () => {
  const customer = await fetch(`${baseUrl}/notifications`, {
    headers: { Authorization: `Bearer ${token(userA)}` },
  });
  assert.equal(customer.status, 403);

  const admin = await fetch(`${baseUrl}/notifications?limit=10`, {
    headers: { Authorization: `Bearer ${token(userA, 'ADMIN')}` },
  });
  assert.equal(admin.status, 200);
  assert.ok((await admin.json()).items.length >= 2);
});
