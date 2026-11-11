const { z } = require('zod');

const baseEvent = {
  eventId: z.string().uuid(),
  occurredAt: z.string().datetime({ offset: true }),
  orderId: z.string().uuid(),
  userId: z.string().uuid(),
};

const orderCreatedSchema = z.object({
  ...baseEvent,
  eventType: z.literal('ORDER_CREATED'),
  totalAmount: z.number(),
});

const stockRejectedSchema = z.object({
  ...baseEvent,
  eventType: z.literal('STOCK_REJECTED'),
  reason: z.string().optional(),
});

const paymentApprovedSchema = z.object({
  ...baseEvent,
  eventType: z.literal('PAYMENT_APPROVED'),
  paymentId: z.string().uuid(),
  amount: z.number(),
});

const paymentRejectedSchema = z.object({
  ...baseEvent,
  eventType: z.literal('PAYMENT_REJECTED'),
  paymentId: z.string().uuid(),
  amount: z.number(),
  reason: z.string().optional(),
});

module.exports = {
  orderCreatedSchema,
  stockRejectedSchema,
  paymentApprovedSchema,
  paymentRejectedSchema,
};
