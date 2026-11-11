export type NotificationType = 'ORDER_RECEIVED' | 'ORDER_CONFIRMED' | 'PAYMENT_REJECTED' | 'ORDER_CANCELLED';

export interface Notification {
  id: string;
  eventId: string;
  eventType: string;
  type: NotificationType;
  orderId: string;
  userId: string;
  channel: string;
  title: string;
  message: string;
  createdAt: string;
}
