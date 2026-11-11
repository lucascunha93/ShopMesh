require('dotenv').config();
// Precisa vir antes de express, http e kafkajs para instrumentá-los.
require('./observability/tracing');

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET deve estar definido');
}

const app = require('./app');
const prisma = require('./config/prisma');
const ensureAdminUser = require('./utils/ensureAdminUser');
const { logStartupError } = require('./utils/logger');

const port = Number(process.env.PORT) || 3001;

async function startServer() {
  const admin = await ensureAdminUser({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    name: process.env.ADMIN_NAME,
  });
  if (admin) {
    console.log(JSON.stringify({
      level: 'info',
      message: 'Administrador inicial verificado',
      service: 'auth-service',
      action: admin.action,
    }));
  }

  const server = app.listen(port, () => {
    console.log(`Auth Service rodando na porta ${port}`);
  });

  async function shutdown() {
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer().catch(async (error) => {
  logStartupError(error);
  await prisma.$disconnect();
  process.exit(1);
});
