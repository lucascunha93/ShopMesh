const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET = 'test-secret-with-at-least-thirty-two-characters';
process.env.JWT_SECRET = SECRET;
process.env.JWT_EXPIRES_IN = '5m';

// Prisma falso em memória: os testes não dependem de Postgres.
const users = new Map();
let nextId = 1;
const fakePrisma = {
  $queryRaw: async () => [{ '?column?': 1 }],
  user: {
    create: async ({ data, select }) => {
      const id = `00000000-0000-4000-8000-${String(nextId++).padStart(12, '0')}`;
      const now = new Date();
      const user = { id, role: 'CUSTOMER', createdAt: now, updatedAt: now, ...data };
      users.set(id, user);
      if (!select) {
        return user;
      }
      return Object.fromEntries(Object.keys(select).filter((key) => select[key]).map((key) => [key, user[key]]));
    },
    findUnique: async ({ where, select }) => {
      const user = where.email
        ? [...users.values()].find((item) => item.email === where.email)
        : users.get(where.id);
      if (!user) {
        return null;
      }
      if (!select) {
        return user;
      }
      return Object.fromEntries(Object.keys(select).filter((key) => select[key]).map((key) => [key, user[key]]));
    },
    count: async () => users.size,
    findMany: async () => [...users.values()],
  },
};

const prismaPath = require.resolve(path.join('..', 'src', 'config', 'prisma'));
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: fakePrisma };

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

function post(route, body) {
  return fetch(`${baseUrl}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const credentials = { name: 'Maria', email: 'maria@teste.com', password: 'segredo123' };

test('GET /health responde ok', async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok', service: 'auth-service' });
});

test('POST /register cria o usuário com senha em hash e token mínimo', async () => {
  const response = await post('/register', credentials);
  assert.equal(response.status, 201);

  const { user, token } = await response.json();
  assert.equal(user.email, credentials.email);
  assert.equal(user.passwordHash, undefined);

  const stored = [...users.values()].find((item) => item.email === credentials.email);
  assert.notEqual(stored.passwordHash, credentials.password);
  assert.equal(await bcrypt.compare(credentials.password, stored.passwordHash), true);

  const payload = jwt.verify(token, SECRET);
  assert.equal(payload.sub, user.id);
  assert.equal(payload.role, 'CUSTOMER');
});

test('POST /register rejeita email repetido e dados inválidos', async () => {
  assert.equal((await post('/register', credentials)).status, 409);

  const invalid = await post('/register', { name: '', email: 'nao-e-email', password: '' });
  assert.equal(invalid.status, 400);
  assert.ok((await invalid.json()).errors.length >= 1);
});

test('POST /login valida as credenciais', async () => {
  const ok = await post('/login', { email: credentials.email, password: credentials.password });
  assert.equal(ok.status, 200);
  assert.ok((await ok.json()).token);

  assert.equal((await post('/login', { email: credentials.email, password: 'errada' })).status, 401);
  assert.equal((await post('/login', { email: 'ninguem@teste.com', password: 'x' })).status, 401);
});

test('GET /me exige token válido', async () => {
  assert.equal((await fetch(`${baseUrl}/me`)).status, 401);
  assert.equal((await fetch(`${baseUrl}/me`, { headers: { Authorization: 'Bearer invalido' } })).status, 401);

  const { token } = await (await post('/login', credentials)).json();
  const response = await fetch(`${baseUrl}/me`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).user.email, credentials.email);
});

test('GET /users é restrito a ADMIN', async () => {
  const { token } = await (await post('/login', credentials)).json();
  const customer = await fetch(`${baseUrl}/users`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(customer.status, 403);

  const adminToken = jwt.sign({ role: 'ADMIN' }, SECRET, { subject: 'admin-id', expiresIn: '5m' });
  const admin = await fetch(`${baseUrl}/users`, { headers: { Authorization: `Bearer ${adminToken}` } });
  assert.equal(admin.status, 200);
  assert.equal((await admin.json()).pagination.total, users.size);
});

test('rota inexistente e JSON malformado têm resposta tratada', async () => {
  assert.equal((await fetch(`${baseUrl}/nao-existe`)).status, 404);

  const malformed = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{invalido',
  });
  assert.equal(malformed.status, 400);
});
