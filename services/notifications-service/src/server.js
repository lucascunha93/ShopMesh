require('dotenv').config();
// Precisa vir antes de express, http e kafkajs para instrumentá-los.
require('./observability/tracing');

const { createApp } = require('./app');
const { startEventProcessing } = require('./config/kafka');
const { createNotificationStore } = require('./store/notificationStore');
const { logError } = require('./utils/logger');

const port = Number(process.env.PORT) || 3003;

async function startServer() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET deve estar definido');
  }

  const store = createNotificationStore({
    mongoUri: process.env.MONGO_URI,
    maxSize: Number(process.env.NOTIFICATIONS_MAX) || 500,
  });
  await store.connect();
  const stopEventProcessing = await startEventProcessing({ store });
  const server = createApp({ store }).listen(port, () => {
    console.log(`Notifications Service rodando na porta ${port}`);
  });

  let shuttingDown = false;
  function shutdown() {
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
      try {
        await store.disconnect();
      } catch (error) {
        logError('Falha ao encerrar a conexão com o banco', error);
      }
      process.exit(0);
    });
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer().catch((error) => {
  logError('Notifications Service failed to start', error);
  process.exit(1);
});
