const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const config = require('./config');
const { httpMetricsMiddleware, metricsHandler } = require('./observability/metrics');
const { logHttpFailures, logProxyError, logRequestError } = require('./utils/logger');

const app = express();
app.disable('x-powered-by');
app.use(httpMetricsMiddleware);
app.get('/metrics', metricsHandler);
app.use(cors({ origin: config.CORS_ORIGINS }));
app.use((req, res, next) => {
  logHttpFailures(req, res, Date.now());
  next();
});

function createServiceProxy(target, serviceName) {
  const proxy = createProxyMiddleware({
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

  // O label "uri" das métricas usa o prefixo do serviço, não a URL completa.
  return (req, res, next) => {
    req.metricsRoute = req.baseUrl;
    return proxy(req, res, next);
  };
}

// Endpoints internos de observabilidade dos serviços não são expostos pelo gateway.
const INTERNAL_PATH = /^\/api\/[^/]+\/(actuator|metrics)(\/|$)/i;
app.use((req, res, next) => {
  if (INTERNAL_PATH.test(req.path)) {
    return res.status(404).json({ message: 'Rota não encontrada' });
  }
  return next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'api-gateway' });
});

app.use('/api/auth', createServiceProxy(config.AUTH_SERVICE_URL, 'auth'));
app.use('/api/catalog', createServiceProxy(config.CATALOG_SERVICE_URL, 'catalog'));
app.use('/api/orders', createServiceProxy(config.ORDERS_SERVICE_URL, 'orders'));
app.use('/api/payments', createServiceProxy(config.PAYMENTS_SERVICE_URL, 'payments'));
app.use('/api/notifications', createServiceProxy(config.NOTIFICATIONS_SERVICE_URL, 'notifications'));

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
