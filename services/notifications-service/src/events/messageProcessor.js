const { deadLetterTopic } = require('./topics');
const { kafkaMessagesProcessed } = require('../observability/metrics');
const { SERVICE_NAME, logError, logWarn, safeErrorMessage } = require('../utils/logger');

class InvalidEventError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'InvalidEventError';
    this.details = details;
  }
}

function defaultSleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parsePayload(message, schema) {
  let json;
  try {
    json = JSON.parse(message.value ? message.value.toString('utf8') : '');
  } catch {
    throw new InvalidEventError('JSON inválido');
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    throw new InvalidEventError('Campos obrigatórios ausentes ou inválidos', result.error.issues);
  }
  return result.data;
}

/**
 * Processa uma mensagem Kafka conforme as regras de docs/events.md:
 * - mensagens inválidas vão direto para <tópico>.DLT, sem novas tentativas;
 * - falhas de processamento são tentadas `maxAttempts` vezes, com intervalo
 *   de `retryDelayMs`, e depois seguem para a DLT;
 * - toda mensagem na DLT carrega o cabeçalho `x-rejected-by`.
 * Se a publicação na DLT falhar, o erro é propagado para que o offset não
 * seja confirmado e a mensagem seja lida novamente.
 */
function createMessageProcessor({
  handlers,
  producer,
  maxAttempts = 3,
  retryDelayMs = 1000,
  sleep = defaultSleep,
}) {
  async function sendToDeadLetter({ topic, partition, message }, error, errorType, attempts) {
    const headers = {
      ...(message.headers || {}),
      'x-rejected-by': SERVICE_NAME,
      'x-error-type': errorType,
      'x-error-message': safeErrorMessage(error) || 'Erro desconhecido',
      'x-original-topic': topic,
      'x-original-partition': String(partition),
      'x-original-offset': String(message.offset),
      'x-attempts': String(attempts),
    };

    await producer.send({
      topic: deadLetterTopic(topic),
      messages: [{ key: message.key, value: message.value, headers }],
    });

    kafkaMessagesProcessed.inc({ topic, outcome: errorType === 'INVALID_EVENT' ? 'dlt_invalid' : 'dlt_failed' });

    logWarn('Mensagem encaminhada para a DLT', {
      topic,
      deadLetterTopic: deadLetterTopic(topic),
      partition,
      offset: message.offset,
      errorType,
      attempts,
      reason: safeErrorMessage(error),
    });
  }

  return async function processMessage(record) {
    const handler = handlers[record.topic];
    if (!handler) {
      logWarn('Mensagem ignorada: tópico sem handler', { topic: record.topic });
      return;
    }

    let event;
    try {
      event = parsePayload(record.message, handler.schema);
    } catch (error) {
      await sendToDeadLetter(record, error, 'INVALID_EVENT', 0);
      return;
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await handler.handle(event);
        kafkaMessagesProcessed.inc({ topic: record.topic, outcome: 'success' });
        return;
      } catch (error) {
        if (error instanceof InvalidEventError) {
          await sendToDeadLetter(record, error, 'INVALID_EVENT', attempt);
          return;
        }

        logError('Falha ao processar evento', error, {
          topic: record.topic,
          orderId: event.orderId,
          attempt,
          maxAttempts,
        });

        if (attempt === maxAttempts) {
          await sendToDeadLetter(record, error, 'PROCESSING_FAILED', attempt);
          return;
        }
        await sleep(retryDelayMs);
      }
    }
  };
}

module.exports = { createMessageProcessor, InvalidEventError, SERVICE_NAME };
