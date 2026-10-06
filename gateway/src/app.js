const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const config = require('./config');
const { logHttpFailures, logProxyError, logRequestError } = require('./utils/logger');

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use((req, res, next) => {
  logHttpFailures(req, res, Date.now());
  next();
});

function createServiceProxy(target, serviceName) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    on: {
      error(error, req, res) {
        logProxyError(error, req, serviceName);
        if (!res.headersSent) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: `Serviço ${serviceName} indisponível` }));
        }
      },
    },
  });
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'api-gateway' });
});

app.use('/api/auth', createServiceProxy(config.AUTH_SERVICE_URL, 'auth'));
app.use('/api/catalog', createServiceProxy(config.CATALOG_SERVICE_URL, 'catalog'));

app.use((req, res) => {
  res.status(404).json({ message: 'Rota não encontrada' });
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ message: 'JSON inválido' });
  }

  logRequestError(error, req, 500);
  return res.status(500).json({ message: 'Erro interno do gateway' });
});

module.exports = app;
