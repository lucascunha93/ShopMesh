const TOPICS = Object.freeze({
  ORDER_CREATED: 'order.created',
  STOCK_RESERVED: 'stock.reserved',
  STOCK_REJECTED: 'stock.rejected',
  PAYMENT_APPROVED: 'payment.approved',
  PAYMENT_REJECTED: 'payment.rejected',
});

const CONSUMED_TOPICS = [TOPICS.ORDER_CREATED, TOPICS.PAYMENT_APPROVED, TOPICS.PAYMENT_REJECTED];
const PRODUCED_TOPICS = [TOPICS.STOCK_RESERVED, TOPICS.STOCK_REJECTED];

function deadLetterTopic(topic) {
  return `${topic}.DLT`;
}

// Tópicos declarados no arranque: os que este serviço produz, os que consome
// (criados de forma idempotente caso ainda não existam) e as DLTs que escreve.
const DECLARED_TOPICS = [
  ...PRODUCED_TOPICS,
  ...CONSUMED_TOPICS,
  ...CONSUMED_TOPICS.map(deadLetterTopic),
];

module.exports = { TOPICS, CONSUMED_TOPICS, DECLARED_TOPICS, deadLetterTopic };
