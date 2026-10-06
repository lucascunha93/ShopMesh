const express = require('express');
const mongoose = require('mongoose');
const productRoutes = require('./routes/productRoutes');
const asyncHandler = require('./utils/asyncHandler');
const { logHttpFailures, logRequestError } = require('./utils/logger');

const app = express();
app.disable('x-powered-by');

app.use((req, res, next) => {
  logHttpFailures(req, res, Date.now());
  next();
});
app.use(express.json());

app.get('/health', asyncHandler(async (req, res) => {
  await mongoose.connection.db.admin().ping();
  res.json({ status: 'ok', service: 'catalog-service' });
}));

app.use(productRoutes);

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
