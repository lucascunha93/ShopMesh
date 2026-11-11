const { randomUUID } = require('node:crypto');
const { TOPICS } = require('./topics');
const { orderCreatedSchema, orderCancelledSchema, paymentApprovedSchema, paymentRejectedSchema } = require('./schemas');
const { SAGA_STATUS } = require('../models/StockReservation');
const { logInfo } = require('../utils/logger');

function buildStockReservedEvent(saga) {
  return {
    eventId: randomUUID(),
    eventType: 'STOCK_RESERVED',
    occurredAt: new Date().toISOString(),
    orderId: saga.orderId,
    userId: saga.userId,
    totalAmount: saga.totalAmount,
    items: saga.items.map(({ productId, quantity }) => ({ productId, quantity })),
  };
}

function buildStockRejectedEvent(saga) {
  return {
    eventId: randomUUID(),
    eventType: 'STOCK_REJECTED',
    occurredAt: new Date().toISOString(),
    orderId: saga.orderId,
    userId: saga.userId,
    reason: saga.reason,
  };
}

function createStockEventHandlers({ stockService, producer }) {
  async function publish(topic, event) {
    await producer.send({
      topic,
      messages: [{ key: event.orderId, value: JSON.stringify(event) }],
    });
    logInfo('Evento publicado', { topic, eventType: event.eventType, orderId: event.orderId });
  }

  async function handleOrderCreated(event) {
    const saga = await stockService.reserveForOrder(event);

    // Publicar novamente em reentregas é seguro: o consumidor é idempotente,
    // e isso cobre falhas entre a gravação da reserva e a publicação.
    if (saga.status === SAGA_STATUS.RESERVED) {
      await publish(TOPICS.STOCK_RESERVED, buildStockReservedEvent(saga));
    } else if (saga.status === SAGA_STATUS.REJECTED) {
      await publish(TOPICS.STOCK_REJECTED, buildStockRejectedEvent(saga));
    } else {
      logInfo('order.created ignorado: Saga já finalizada', { orderId: event.orderId, status: saga.status });
    }
  }

  return {
    [TOPICS.ORDER_CREATED]: {
      schema: orderCreatedSchema,
      handle: handleOrderCreated,
    },
    [TOPICS.ORDER_CANCELLED]: {
      schema: orderCancelledSchema,
      handle: (event) => stockService.releaseForOrder(event),
    },
    [TOPICS.PAYMENT_APPROVED]: {
      schema: paymentApprovedSchema,
      handle: (event) => stockService.commitForOrder(event),
    },
    [TOPICS.PAYMENT_REJECTED]: {
      schema: paymentRejectedSchema,
      handle: (event) => stockService.releaseForOrder(event),
    },
  };
}

module.exports = { createStockEventHandlers, buildStockReservedEvent, buildStockRejectedEvent };
