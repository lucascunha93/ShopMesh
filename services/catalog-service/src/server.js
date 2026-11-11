require('dotenv').config();
// Precisa vir antes de express, http e kafkajs para instrumentá-los.
require('./observability/tracing');

const app = require('./app');
const mongoose = require('mongoose');
const { connectDatabase } = require('./config/database');
const { startEventProcessing } = require('./config/kafka');
const Product = require('./models/Product');
const StockReservation = require('./models/StockReservation');
const { logError, logStartupError } = require('./utils/logger');

const port = Number(process.env.PORT) || 3002;

async function startServer() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET deve estar definido');
  }

  await connectDatabase();
  await Product.init();
  await StockReservation.init();
  const stopEventProcessing = await startEventProcessing();

  const server = app.listen(port, () => {
    console.log(`Catalog Service rodando na porta ${port}`);
  });

  let shuttingDown = false;
  async function shutdown() {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    server.close(async () => {
      try {
        await stopEventProcessing();
      } catch (error) {
        logError('Falha ao encerrar o Kafka', error);
      }
      await mongoose.disconnect();
      process.exit(0);
    });
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer().catch((error) => {
  logStartupError(error);
  process.exit(1);
});
