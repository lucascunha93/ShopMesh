const TOPICS = Object.freeze({
  ORDER_CREATED: 'order.created',
  STOCK_REJECTED: 'stock.rejected',
  PAYMENT_APPROVED: 'payment.approved',
  PAYMENT_REJECTED: 'payment.rejected',
});

const CONSUMED_TOPICS = Object.values(TOPICS);

function deadLetterTopic(topic) {
  return `${topic}.DLT`;
}

const DECLARED_TOPICS = [...CONSUMED_TOPICS, ...CONSUMED_TOPICS.map(deadLetterTopic)];

module.exports = { TOPICS, CONSUMED_TOPICS, DECLARED_TOPICS, deadLetterTopic };
