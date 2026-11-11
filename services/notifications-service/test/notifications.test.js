const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { createApp } = require('../src/app');
const { createNotificationStore } = require('../src/store/notificationStore');
const { createNotificationHandlers } = require('../src/events/notificationHandlers');

const SECRET = 'test-secret-with-at-least-thirty-two-characters';
const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';
const orderId = '6f1c3b1e-8a43-4e57-9d0a-1b2c3d4e5f60';

function paymentApproved(eventId, userId = userA) {
  return {
    eventId,
    eventType: 'PAYMENT_APPROVED',
    occurredAt: '2026-10-07T03:20:06.021Z',
    orderId,
    paymentId: '33333333-3333-4333-8333-333333333333',
    userId,
    amount: 699.8,
  };
}

let server;
let baseUrl;
const store = createNotificationStore({ maxSize: 3 });
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

test('pagamento aprovado gera notificação legível e duplicatas são ignoradas', async () => {
  const event = paymentApproved('44444444-4444-4444-8444-444444444444');
  await handlers['payment.approved'].handle(event);
  await handlers['payment.approved'].handle(event);

  const [notification, ...rest] = store.list({ userId: userA });
  assert.equal(rest.length, 0);
  assert.equal(notification.type, 'ORDER_CONFIRMED');
  assert.equal(notification.title, 'Pedido confirmado');
  assert.match(notification.message, /#6f1c3b1e/);
  assert.match(notification.message, /699,80/);
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

  const [notification] = store.list({ userId: userB });
  assert.equal(notification.type, 'ORDER_CANCELLED');
  assert.match(notification.message, /Estoque insuficiente para Café/);
});

test('cancelamento manual do pedido notifica o cliente', async () => {
  const isolatedStore = createNotificationStore({ maxSize: 5 });
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

  const [notification] = isolatedStore.list({ userId: userA });
  assert.equal(notification.type, 'ORDER_CANCELLED');
  assert.match(notification.message, /#6f1c3b1e.*cancelado/);
});

test('store descarta as notificações mais antigas acima do limite', () => {
  const small = createNotificationStore({ maxSize: 2 });
  small.add({ eventId: 'a', userId: userA });
  small.add({ eventId: 'b', userId: userA });
  small.add({ eventId: 'c', userId: userA });
  assert.deepEqual(small.list().map((n) => n.eventId), ['c', 'b']);
  assert.equal(small.add({ eventId: 'a', userId: userA }), true);
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
