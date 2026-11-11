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

const orderCancelledSchema = z.object({
  ...baseEvent,
  eventType: z.literal('ORDER_CANCELLED'),
  userId: z.string().uuid(),
  reason: z.string().nullish(),
});

const paymentApprovedSchema = z.object({
  ...baseEvent,
  eventType: z.literal('PAYMENT_APPROVED'),
  paymentId: z.string().uuid(),
  userId: z.string().uuid(),
  amount: z.number(),
});

const paymentRejectedSchema = z.object({
  ...baseEvent,
  eventType: z.literal('PAYMENT_REJECTED'),
  paymentId: z.string().uuid(),
  userId: z.string().uuid(),
  amount: z.number(),
  reason: z.string().optional(),
});

module.exports = {
  orderCreatedSchema,
  orderCancelledSchema,
  paymentApprovedSchema,
  paymentRejectedSchema,
};
