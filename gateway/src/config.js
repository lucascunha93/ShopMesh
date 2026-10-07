const { z } = require('zod');

const configSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  AUTH_SERVICE_URL: z.string().url().default('http://localhost:3001'),
  CATALOG_SERVICE_URL: z.string().url().default('http://localhost:3002'),
  ORDERS_SERVICE_URL: z.string().url().default('http://localhost:8081'),
});

module.exports = configSchema.parse(process.env);
