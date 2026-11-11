export type Role = 'CUSTOMER' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ListResponse<T> {
  items: T[];
  pagination: Pagination;
}

export interface Product {
  _id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  stock: number;
  reserved?: number;
  availableStock?: number;
  imageUrl?: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type ProductInput = Partial<
  Pick<Product, 'name' | 'description' | 'price' | 'category' | 'stock' | 'imageUrl' | 'active'>
>;

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

/** Página no formato serializado pelo Spring Data. */
export interface SpringPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  status: 'APPROVED' | 'REJECTED';
  reason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  eventId: string;
  eventType: string;
  type: string;
  orderId: string;
  userId: string;
  channel: string;
  title: string;
  message: string;
  createdAt: string;
}
