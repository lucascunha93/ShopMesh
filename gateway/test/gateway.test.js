const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

let upstream;
let gateway;
let gatewayUrl;
let lastRequest;

before(async () => {
  upstream = http.createServer((req, res) => {
    lastRequest = { method: req.method, url: req.url, auth: req.headers.authorization };
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ upstream: true }));
  });
  await new Promise((resolve) => { upstream.listen(0, '127.0.0.1', resolve); });

  process.env.AUTH_SERVICE_URL = `http://127.0.0.1:${upstream.address().port}`;
  // Porta fechada: simula o serviço de catálogo fora do ar.
  process.env.CATALOG_SERVICE_URL = 'http://127.0.0.1:1';

  const app = require('../src/app');
  gateway = app.listen(0);
  await new Promise((resolve) => { gateway.once('listening', resolve); });
  gatewayUrl = `http://127.0.0.1:${gateway.address().port}`;
});

after(() => {
  gateway.close();
  upstream.close();
});

test('GET /health responde ok', async () => {
  const response = await fetch(`${gatewayUrl}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok', service: 'api-gateway' });
});

test('/api/auth/* é encaminhado ao serviço sem o prefixo e preserva o Authorization', async () => {
  const response = await fetch(`${gatewayUrl}/api/auth/login`, {
    method: 'POST',
    headers: { Authorization: 'Bearer abc' },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { upstream: true });
  assert.deepEqual(lastRequest, { method: 'POST', url: '/login', auth: 'Bearer abc' });
});

test('serviço indisponível resulta em 503 com mensagem em JSON', async () => {
  const response = await fetch(`${gatewayUrl}/api/catalog/products`);
  assert.equal(response.status, 503);
  assert.match((await response.json()).message, /catalog/);
});

test('endpoints internos de observabilidade dos serviços não são expostos', async () => {
  for (const route of ['/api/auth/metrics', '/api/orders/actuator/health']) {
    const response = await fetch(`${gatewayUrl}${route}`);
    assert.equal(response.status, 404, route);
  }
});

test('rota desconhecida retorna 404', async () => {
  assert.equal((await fetch(`${gatewayUrl}/qualquer`)).status, 404);
});
