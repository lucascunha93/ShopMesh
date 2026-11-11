const { Kafka, Partitioners, logLevel } = require('kafkajs');
const { CONSUMED_TOPICS, DECLARED_TOPICS } = require('../events/topics');
const { createMessageProcessor } = require('../events/messageProcessor');
const { createStockEventHandlers } = require('../events/stockEventHandlers');
const { createStockService } = require('../services/stockService');
const { logInfo } = require('../utils/logger');

const KAFKA_LOG_LEVELS = {
  [logLevel.ERROR]: 'error',
  [logLevel.WARN]: 'warn',
  [logLevel.INFO]: 'info',
  [logLevel.DEBUG]: 'debug',
};

function kafkaLogCreator() {
  return ({ level, log }) => {
    const { message, ...extra } = log;
    const output = level === logLevel.ERROR ? console.error : console.warn;
    output(JSON.stringify({
      level: KAFKA_LOG_LEVELS[level] || 'info',
      message: `kafka: ${message}`,
      service: 'catalog-service',
      broker: extra.broker,
      groupId: extra.groupId,
    }));
  };
}

function createKafka() {
  const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092')
    .split(',')
    .map((broker) => broker.trim())
    .filter(Boolean);

  return new Kafka({
    clientId: 'catalog-service',
    brokers,
    logLevel: logLevel.WARN,
    logCreator: kafkaLogCreator,
  });
}

async function startEventProcessing() {
  const kafka = createKafka();
  const admin = kafka.admin();
  await admin.connect();
  await admin.createTopics({
    waitForLeaders: true,
    topics: DECLARED_TOPICS.map((topic) => ({ topic, numPartitions: 3, replicationFactor: 1 })),
  });
  await admin.disconnect();

  // O particionador padrão é compatível com o do cliente Java (murmur2), então
  // a mesma chave orderId cai na mesma partição em qualquer serviço.
  const producer = kafka.producer({
    createPartitioner: Partitioners.DefaultPartitioner,
    idempotent: true,
    maxInFlightRequests: 1,
  });
  await producer.connect();

  const handlers = createStockEventHandlers({ stockService: createStockService(), producer });
  const processMessage = createMessageProcessor({ handlers, producer });

  const consumer = kafka.consumer({ groupId: 'catalog-service' });
  await consumer.connect();
  await consumer.subscribe({ topics: CONSUMED_TOPICS, fromBeginning: true });
  await consumer.run({ eachMessage: processMessage });

  logInfo('Consumidor Kafka iniciado', { topics: CONSUMED_TOPICS, groupId: 'catalog-service' });

  return async function stopEventProcessing() {
    await consumer.disconnect();
    await producer.disconnect();
  };
}

module.exports = { startEventProcessing };
