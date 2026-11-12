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

const orderCancelledSchema = z.object({
  ...baseEvent,
  eventType: z.literal('ORDER_CANCELLED'),
  reason: z.string().nullish(),
});

const stockRejectedSchema = z.object({
  ...baseEvent,
  eventType: z.literal('STOCK_REJECTED'),
  reason: z.string().optional(),
});

const orderConfirmedSchema = z.object({
  ...baseEvent,
  eventType: z.literal('ORDER_CONFIRMED'),
  totalAmount: z.number(),
});

const paymentRejectedSchema = z.object({
  ...baseEvent,
  eventType: z.literal('PAYMENT_REJECTED'),
  paymentId: z.string().uuid(),
  amount: z.number(),
  reason: z.string().optional(),
});

const paymentRefundedSchema = z.object({
  ...baseEvent,
  eventType: z.literal('PAYMENT_REFUNDED'),
  paymentId: z.string().uuid(),
  amount: z.number(),
  reason: z.string().nullish(),
});

module.exports = {
  orderCreatedSchema,
  orderCancelledSchema,
  stockRejectedSchema,
  orderConfirmedSchema,
  paymentRejectedSchema,
  paymentRefundedSchema,
};
