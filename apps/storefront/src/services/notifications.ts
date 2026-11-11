import api from './api';
import type { Notification } from '../types/Notification';

export async function listMyNotifications(limit = 10, signal?: AbortSignal): Promise<Notification[]> {
  const response = await api.get<{ items: Notification[] }>('/api/notifications/notifications/me', {
    params: { limit },
    signal,
  });
  return response.data.items;
}
