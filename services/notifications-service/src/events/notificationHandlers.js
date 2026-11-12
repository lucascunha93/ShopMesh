const { randomUUID } = require('node:crypto');
const { TOPICS } = require('./topics');
const {
  orderCreatedSchema,
  orderCancelledSchema,
  orderConfirmedSchema,
  stockRejectedSchema,
  paymentRejectedSchema,
  paymentRefundedSchema,
} = require('./schemas');
const { logInfo } = require('../utils/logger');

function formatAmount(amount) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
}

function shortId(orderId) {
  return orderId.slice(0, 8);
}

const TEMPLATES = {
  ORDER_CANCELLED: (event) => ({
    type: 'ORDER_CANCELLED',
    title: 'Pedido cancelado',
    message: `O pedido #${shortId(event.orderId)} foi cancelado`
      + `${event.reason ? `: ${event.reason}` : '.'}`,
  }),
  ORDER_CREATED: (event) => ({
    type: 'ORDER_RECEIVED',
    title: 'Pedido recebido',
    message: `Recebemos o pedido #${shortId(event.orderId)} no valor de ${formatAmount(event.totalAmount)}. `
      + 'Estamos reservando os itens.',
  }),
  STOCK_REJECTED: (event) => ({
    type: 'ORDER_CANCELLED',
    title: 'Pedido cancelado',
    message: `Não conseguimos reservar os itens do pedido #${shortId(event.orderId)}`
      + `${event.reason ? `: ${event.reason}` : '.'}`,
  }),
  ORDER_CONFIRMED: (event) => ({
    type: 'ORDER_CONFIRMED',
    title: 'Pedido confirmado',
    message: `O pedido #${shortId(event.orderId)} no valor de ${formatAmount(event.totalAmount)} `
      + 'está confirmado.',
  }),
  PAYMENT_REJECTED: (event) => ({
    type: 'PAYMENT_REJECTED',
    title: 'Pagamento recusado',
    message: `O pagamento do pedido #${shortId(event.orderId)} foi recusado`
      + `${event.reason ? `: ${event.reason}` : '.'}`,
  }),
  PAYMENT_REFUNDED: (event) => ({
    type: 'PAYMENT_REFUNDED',
    title: 'Pagamento estornado',
    message: `O pagamento de ${formatAmount(event.amount)} do pedido #${shortId(event.orderId)} foi estornado`
      + `${event.reason ? `: ${event.reason}` : '.'}`,
  }),
};

function buildNotification(event) {
  return {
    id: randomUUID(),
    eventId: event.eventId,
    eventType: event.eventType,
    orderId: event.orderId,
    userId: event.userId,
    channel: 'email',
    ...TEMPLATES[event.eventType](event),
    createdAt: new Date().toISOString(),
  };
}

function createNotificationHandlers({ store }) {
  async function notify(event) {
    const notification = buildNotification(event);
    if (!(await store.add(notification))) {
      logInfo('Notificação duplicada ignorada', { eventId: event.eventId, orderId: event.orderId });
      return;
    }

    // Simula o envio: o canal real (email/SMS/push) seria plugado aqui.
    logInfo('Notificação enviada', {
      notificationId: notification.id,
      channel: notification.channel,
      type: notification.type,
      orderId: notification.orderId,
      userId: notification.userId,
    });
  }

  return {
    [TOPICS.ORDER_CREATED]: { schema: orderCreatedSchema, handle: notify },
    [TOPICS.STOCK_REJECTED]: { schema: stockRejectedSchema, handle: notify },
    [TOPICS.ORDER_CANCELLED]: { schema: orderCancelledSchema, handle: notify },
    [TOPICS.ORDER_CONFIRMED]: { schema: orderConfirmedSchema, handle: notify },
    [TOPICS.PAYMENT_REJECTED]: { schema: paymentRejectedSchema, handle: notify },
    [TOPICS.PAYMENT_REFUNDED]: { schema: paymentRefundedSchema, handle: notify },
  };
}

module.exports = { createNotificationHandlers, buildNotification };
