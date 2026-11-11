export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

export interface Order {
  id: string;
  userId: string;
  status: OrderStatus;
  statusReason?: string | null;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export type PaymentStatus = 'APPROVED' | 'REJECTED';

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  status: PaymentStatus;
  reason?: string | null;
  createdAt: string;
  updatedAt: string;
}
