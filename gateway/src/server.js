require('dotenv').config();
// Precisa vir antes de express, http e kafkajs para instrumentá-los.
require('./observability/tracing');

const app = require('./app');
const { PORT } = require('./config');

app.listen(PORT, () => {
  console.log(`API Gateway rodando na porta ${PORT}`);
});
