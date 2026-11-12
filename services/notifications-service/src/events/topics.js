const TOPICS = Object.freeze({
  ORDER_CREATED: 'order.created',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_CONFIRMED: 'order.confirmed',
  STOCK_REJECTED: 'stock.rejected',
  PAYMENT_REJECTED: 'payment.rejected',
  PAYMENT_REFUNDED: 'payment.refunded',
});

const CONSUMED_TOPICS = Object.values(TOPICS);

function deadLetterTopic(topic) {
  return `${topic}.DLT`;
}

const DECLARED_TOPICS = [...CONSUMED_TOPICS, ...CONSUMED_TOPICS.map(deadLetterTopic)];

module.exports = { TOPICS, CONSUMED_TOPICS, DECLARED_TOPICS, deadLetterTopic };
