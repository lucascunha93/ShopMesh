const mongoose = require('mongoose');

const NOTIFICATION_TTL_SECONDS = 30 * 24 * 60 * 60;
const DUPLICATE_KEY_ERROR = 11000;

const notificationSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    eventId: { type: String, required: true },
    eventType: { type: String, required: true },
    orderId: { type: String, required: true },
    userId: { type: String, required: true },
    channel: { type: String, required: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    createdAt: { type: Date, required: true },
  },
  { versionKey: false },
);

// Dedupe por evento (entrega at-least-once do Kafka).
notificationSchema.index({ eventId: 1 }, { unique: true });
// Feed do usuário, mais recentes primeiro.
notificationSchema.index({ userId: 1, createdAt: -1 });
// Expiração automática das notificações antigas.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: NOTIFICATION_TTL_SECONDS });

const NotificationModel = mongoose.models.Notification
  || mongoose.model('Notification', notificationSchema);

function toNotification(document) {
  const { _id, createdAt, ...rest } = document;
  return { ...rest, createdAt: createdAt.toISOString() };
}

function createMongoNotificationStore({ mongoUri, Model = NotificationModel }) {
  async function connect() {
    await mongoose.connect(mongoUri);
    // Garante que os índices (inclusive o TTL e o unique) existam antes de consumir.
    await Model.init();
  }

  async function disconnect() {
    await mongoose.disconnect();
  }

  async function add(notification) {
    try {
      await Model.create({ ...notification, createdAt: new Date(notification.createdAt) });
      return true;
    } catch (error) {
      if (error.code === DUPLICATE_KEY_ERROR) {
        return false;
      }
      throw error;
    }
  }

  async function list({ userId, limit = 50 } = {}) {
    const filter = userId ? { userId } : {};
    const documents = await Model.find(filter, { __v: 0 })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .lean();
    return documents.map(toNotification);
  }

  return { type: 'mongo', connect, disconnect, add, list };
}

module.exports = { createMongoNotificationStore, NOTIFICATION_TTL_SECONDS };
