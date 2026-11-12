const { z } = require('zod');

// Consumidores ignoram campos desconhecidos (zod descarta chaves extras).
const baseEvent = {
  eventId: z.string().uuid(),
  occurredAt: z.string().datetime({ offset: true }),
  orderId: z.string().uuid(),
};

const orderCreatedSchema = z.object({
  ...baseEvent,
  eventType: z.literal('ORDER_CREATED'),
  userId: z.string().uuid(),
  totalAmount: z.number().nonnegative(),
  items: z.array(z.object({
    productId: z.string().trim().min(1),
    quantity: z.number().int().positive(),
    unitPrice: z.number().nonnegative().optional(),
  })).min(1),
});

const stockCommitSchema = z.object({
  ...baseEvent,
  eventType: z.literal('STOCK_COMMIT_REQUESTED'),
  userId: z.string().uuid(),
});

const stockReleaseSchema = z.object({
  ...baseEvent,
  eventType: z.literal('STOCK_RELEASE_REQUESTED'),
  userId: z.string().uuid(),
  reason: z.string().nullish(),
});

module.exports = {
  orderCreatedSchema,
  stockCommitSchema,
  stockReleaseSchema,
};
