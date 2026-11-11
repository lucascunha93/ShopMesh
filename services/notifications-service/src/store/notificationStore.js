/**
 * Armazenamento em memória das notificações mais recentes. O serviço não tem
 * banco: ao reiniciar, o feed recomeça a partir do que o Kafka reentregar.
 * A deduplicação por eventId torna o consumo idempotente (at-least-once).
 */
function createNotificationStore({ maxSize = 500 } = {}) {
  const notifications = [];
  const eventIds = new Set();

  function add(notification) {
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

  function list({ userId, limit = 50 } = {}) {
    const filtered = userId
      ? notifications.filter((notification) => notification.userId === userId)
      : notifications;
    return filtered.slice(0, limit);
  }

  return { add, list, size: () => notifications.length };
}

module.exports = { createNotificationStore };
