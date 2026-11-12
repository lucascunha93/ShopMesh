import api from './api';
import type { CartItem } from '../context/CartContext';

interface ServerCart {
  items: CartItem[];
  updatedAt?: string | null;
}

// O gateway remove /api/orders; o serviço expõe o carrinho em /cart.
export async function fetchCart(): Promise<CartItem[]> {
  const response = await api.get<ServerCart>('/api/orders/cart');
  return response.data.items ?? [];
}

export async function saveCart(items: CartItem[]): Promise<void> {
  await api.put('/api/orders/cart', { items });
}
