const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const config = require('./config');

const app = express();
app.disable('x-powered-by');

function createServiceProxy(target, serviceName) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    on: {
      error(error, req, res) {
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

  return res.status(500).json({ message: 'Erro interno do gateway' });
});

module.exports = app;
