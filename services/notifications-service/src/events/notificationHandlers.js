const { randomUUID } = require('node:crypto');
const { TOPICS } = require('./topics');
const {
  orderCreatedSchema,
  stockRejectedSchema,
  paymentApprovedSchema,
  paymentRejectedSchema,
} = require('./schemas');
const { logInfo } = require('../utils/logger');

function formatAmount(amount) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
}

function shortId(orderId) {
  return orderId.slice(0, 8);
}

const TEMPLATES = {
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
  PAYMENT_APPROVED: (event) => ({
    type: 'ORDER_CONFIRMED',
    title: 'Pedido confirmado',
    message: `O pagamento de ${formatAmount(event.amount)} foi aprovado e o pedido `
      + `#${shortId(event.orderId)} está confirmado.`,
  }),
  PAYMENT_REJECTED: (event) => ({
    type: 'PAYMENT_REJECTED',
    title: 'Pagamento recusado',
    message: `O pagamento do pedido #${shortId(event.orderId)} foi recusado`
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
    if (!store.add(notification)) {
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
    [TOPICS.PAYMENT_APPROVED]: { schema: paymentApprovedSchema, handle: notify },
    [TOPICS.PAYMENT_REJECTED]: { schema: paymentRejectedSchema, handle: notify },
  };
}

module.exports = { createNotificationHandlers, buildNotification };
