const express = require('express');
const { httpMetricsMiddleware, metricsHandler } = require('./observability/metrics');
const { z } = require('zod');
const { authenticateToken, requireAdmin } = require('./middleware/authenticateToken');
const asyncHandler = require('./utils/asyncHandler');
const { logError, logHttpFailures } = require('./utils/logger');

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

function createApp({ store }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(httpMetricsMiddleware);
  app.get('/metrics', metricsHandler);

  app.use((req, res, next) => {
    logHttpFailures(req, res, Date.now());
    next();
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'notifications-service', store: store.type });
  });

  function parseLimit(req, res) {
    const result = listQuerySchema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({ message: 'Dados inválidos', errors: result.error.issues });
      return null;
    }
    return result.data.limit;
  }

  // Notificações do usuário autenticado.
  app.get('/notifications/me', authenticateToken, asyncHandler(async (req, res) => {
    const limit = parseLimit(req, res);
    if (limit === null) {
      return undefined;
    }
    return res.json({ items: await store.list({ userId: req.auth.userId, limit }) });
  }));

  // Visão operacional de todas as notificações (ADMIN).
  app.get('/notifications', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const limit = parseLimit(req, res);
    if (limit === null) {
      return undefined;
    }
    return res.json({ items: await store.list({ limit }) });
  }));

  app.use((req, res) => {
    res.status(404).json({ message: 'Rota não encontrada' });
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }
    logError('Unhandled request error', error, { method: req.method, path: req.path });
    return res.status(500).json({ message: 'Erro interno do servidor' });
  });

  return app;
}

module.exports = { createApp };
