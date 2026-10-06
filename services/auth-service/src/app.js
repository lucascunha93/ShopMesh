const express = require('express');
const authRoutes = require('./routes/authRoutes');
const asyncHandler = require('./utils/asyncHandler');
const prisma = require('./config/prisma');
const { logHttpFailures, logRequestError } = require('./utils/logger');

const app = express();
app.disable('x-powered-by');

app.use((req, res, next) => {
  logHttpFailures(req, res, Date.now());
  next();
});
app.use(express.json());

app.get('/health', asyncHandler(async (req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: 'ok', service: 'auth-service' });
}));

app.use(authRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Rota não encontrada' });
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error.code === 'P2002') {
    return res.status(409).json({ message: 'Email já cadastrado' });
  }

  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ message: 'JSON inválido' });
  }

  const status = error.status || 500;
  if (status >= 500) {
    logRequestError(error, req, status);
  }
  const response = { message: status >= 500 ? 'Erro interno do servidor' : error.message };

  if (error.details) {
    response.errors = error.details;
  }

  return res.status(status).json(response);
});

module.exports = app;
