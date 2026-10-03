require('dotenv').config();

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET deve estar definido');
}

const app = require('./app');
const prisma = require('./config/prisma');

const port = Number(process.env.PORT) || 3001;
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
