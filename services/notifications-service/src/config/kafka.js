const { Kafka, Partitioners, logLevel } = require('kafkajs');
const { CONSUMED_TOPICS, DECLARED_TOPICS } = require('../events/topics');
const { createMessageProcessor } = require('../events/messageProcessor');
const { createNotificationHandlers } = require('../events/notificationHandlers');
const { SERVICE_NAME, logInfo } = require('../utils/logger');

function kafkaLogCreator() {
  return ({ level, log }) => {
    const output = level === logLevel.ERROR ? console.error : console.warn;
    output(JSON.stringify({
      level: level === logLevel.ERROR ? 'error' : 'warn',
      message: `kafka: ${log.message}`,
      service: SERVICE_NAME,
      broker: log.broker,
      groupId: log.groupId,
    }));
  };
}

async function startEventProcessing({ store }) {
  const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092')
    .split(',')
    .map((broker) => broker.trim())
    .filter(Boolean);
  const kafka = new Kafka({
    clientId: SERVICE_NAME,
    brokers,
    logLevel: logLevel.WARN,
    logCreator: kafkaLogCreator,
  });

  const admin = kafka.admin();
  await admin.connect();
  await admin.createTopics({
    waitForLeaders: true,
    topics: DECLARED_TOPICS.map((topic) => ({ topic, numPartitions: 3, replicationFactor: 1 })),
  });
  await admin.disconnect();

  // O producer só é usado para encaminhar mensagens rejeitadas às DLTs.
  const producer = kafka.producer({
    createPartitioner: Partitioners.DefaultPartitioner,
    idempotent: true,
    maxInFlightRequests: 1,
  });
  await producer.connect();

  const processMessage = createMessageProcessor({
    handlers: createNotificationHandlers({ store }),
    producer,
  });

  const consumer = kafka.consumer({ groupId: SERVICE_NAME });
  await consumer.connect();
  // O consumidor começa pelas mensagens novas; reentregas são deduplicadas por eventId no store.
  await consumer.subscribe({ topics: CONSUMED_TOPICS, fromBeginning: false });
  await consumer.run({ eachMessage: processMessage });

  logInfo('Consumidor Kafka iniciado', { topics: CONSUMED_TOPICS, groupId: SERVICE_NAME });

  return async function stopEventProcessing() {
    await consumer.disconnect();
    await producer.disconnect();
  };
}

module.exports = { startEventProcessing };
