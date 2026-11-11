import axios from 'axios';
import api from './api';
import type { Order, Page, Payment } from '../types/Order';

export interface CreateOrderItem {
  productId: string;
  quantity: number;
}

export async function createOrder(items: CreateOrderItem[]): Promise<Order> {
  const response = await api.post<Order>('/api/orders/orders', { items });
  return response.data;
}

export async function listMyOrders(page: number, size: number, signal?: AbortSignal): Promise<Page<Order>> {
  const response = await api.get<Page<Order>>('/api/orders/orders', { params: { page, size }, signal });
  return response.data;
}

export async function getOrder(id: string, signal?: AbortSignal): Promise<Order> {
  const response = await api.get<Order>(`/api/orders/orders/${id}`, { signal });
  return response.data;
}

// O gateway remove /api/payments; o serviço também começa com /payments.
export async function getPaymentForOrder(orderId: string, signal?: AbortSignal): Promise<Payment | null> {
  try {
    const response = await api.get<Payment>(`/api/payments/payments/order/${orderId}`, { signal });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}
