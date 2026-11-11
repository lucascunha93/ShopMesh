const { z } = require('zod');

const configSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  AUTH_SERVICE_URL: z.string().url().default('http://localhost:3001'),
  CATALOG_SERVICE_URL: z.string().url().default('http://localhost:3002'),
  ORDERS_SERVICE_URL: z.string().url().default('http://localhost:8081'),
  PAYMENTS_SERVICE_URL: z.string().url().default('http://localhost:8083'),
  NOTIFICATIONS_SERVICE_URL: z.string().url().default('http://localhost:3003'),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://127.0.0.1:5173,http://localhost:4200,http://127.0.0.1:4200')
    .transform((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean)),
});

module.exports = configSchema.parse(process.env);
