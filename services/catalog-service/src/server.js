require('dotenv').config();

const app = require('./app');
const mongoose = require('mongoose');
const { connectDatabase } = require('./config/database');
const Product = require('./models/Product');

const port = Number(process.env.PORT) || 3002;

async function startServer() {
  await connectDatabase();
  await Product.init();
  const server = app.listen(port, () => {
    console.log(`Catalog Service rodando na porta ${port}`);
  });

  async function shutdown() {
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer().catch((error) => {
  console.error('Não foi possível iniciar o Catalog Service:', error.message);
  process.exit(1);
});
