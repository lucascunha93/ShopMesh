import api from './api';
import type { Product, ProductListResponse } from '../types/Product';

export async function listProducts(
  page: number,
  limit: number,
  signal?: AbortSignal,
): Promise<ProductListResponse> {
  const response = await api.get<ProductListResponse>('/api/catalog/products', {
    params: { page, limit },
    signal,
  });
  return response.data;
}

export async function getProduct(id: string, signal?: AbortSignal): Promise<Product> {
  const response = await api.get<{ product: Product }>(`/api/catalog/products/${id}`, { signal });
  return response.data.product;
}
