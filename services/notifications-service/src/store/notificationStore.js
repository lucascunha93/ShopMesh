const { createMongoNotificationStore } = require('./mongoNotificationStore');
const { logWarn } = require('../utils/logger');

/**
 * Armazenamento em memória das notificações mais recentes, usado nos testes e
 * quando MONGO_URI não está definido: ao reiniciar, o feed é perdido.
 * A deduplicação por eventId torna o consumo idempotente (at-least-once).
 * A interface é assíncrona para ser intercambiável com a implementação MongoDB.
 */
function createMemoryNotificationStore({ maxSize = 500 } = {}) {
  const notifications = [];
  const eventIds = new Set();

  async function add(notification) {
    if (eventIds.has(notification.eventId)) {
      return false;
    }

    notifications.unshift(notification);
    eventIds.add(notification.eventId);

    while (notifications.length > maxSize) {
      const removed = notifications.pop();
      eventIds.delete(removed.eventId);
    }
    return true;
  }

  async function list({ userId, limit = 50 } = {}) {
    const filtered = userId
      ? notifications.filter((notification) => notification.userId === userId)
      : notifications;
    return filtered.slice(0, limit);
  }

  return {
    type: 'memory',
    connect: async () => {},
    disconnect: async () => {},
    add,
    list,
  };
}

// Escolhe o store conforme a configuração: MongoDB quando há MONGO_URI.
function createNotificationStore({ mongoUri, maxSize } = {}) {
  if (mongoUri) {
    return createMongoNotificationStore({ mongoUri });
  }

  logWarn('MONGO_URI não definido: notificações em memória, serão perdidas ao reiniciar');
  return createMemoryNotificationStore({ maxSize });
}

module.exports = { createNotificationStore, createMemoryNotificationStore };
