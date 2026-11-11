const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const SECRET = 'test-secret-with-at-least-thirty-two-characters';
process.env.JWT_SECRET = SECRET;
const app = require('../src/app');

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => { server.once('listening', resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
});

function token(role) {
  return jwt.sign({ role }, SECRET, { subject: '11111111-1111-4111-8111-111111111111', expiresIn: '5m' });
}

function request(method, path, { auth, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    headers.Authorization = `Bearer ${auth}`;
  }
  return fetch(`${baseUrl}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
}

test('criar produto sem token retorna 401', async () => {
  const response = await request('POST', '/products', { body: { name: 'x', price: 1 } });
  assert.equal(response.status, 401);
});

test('criar produto como CUSTOMER retorna 403', async () => {
  const response = await request('POST', '/products', { auth: token('CUSTOMER'), body: { name: 'x', price: 1 } });
  assert.equal(response.status, 403);
});

test('atualizar produto como CUSTOMER retorna 403', async () => {
  const response = await request('PATCH', '/products/65a000000000000000000001', {
    auth: token('CUSTOMER'),
    body: { price: 10 },
  });
  assert.equal(response.status, 403);
});

test('atualização vazia ou com campo desconhecido retorna 400 para ADMIN', async () => {
  const empty = await request('PATCH', '/products/65a000000000000000000001', { auth: token('ADMIN'), body: {} });
  assert.equal(empty.status, 400);
  const unknown = await request('PATCH', '/products/65a000000000000000000001', {
    auth: token('ADMIN'),
    body: { reserved: 0 },
  });
  assert.equal(unknown.status, 400);
});

test('listar inativos exige ADMIN e token inválido é recusado', async () => {
  const anonymous = await request('GET', '/products?includeInactive=true');
  assert.equal(anonymous.status, 403);
  const invalid = await request('GET', '/products', { auth: 'token-invalido' });
  assert.equal(invalid.status, 401);
});
