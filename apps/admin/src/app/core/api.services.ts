import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { API_URL } from './api-config';
import {
  ListResponse,
  Notification,
  Order,
  OrderStatus,
  Payment,
  Product,
  ProductInput,
  SpringPage,
  User,
} from './models';

type QueryValue = string | number | boolean | null | undefined;

function toParams(values: Record<string, QueryValue>): HttpParams {
  let result = new HttpParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined && value !== '') {
      result = result.set(key, String(value));
    }
  }
  return result;
}

@Injectable({ providedIn: 'root' })
export class OrdersApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_URL)}/api/orders/orders`;

  listAll(page: number, size: number, status?: OrderStatus | null): Observable<SpringPage<Order>> {
    return this.http.get<SpringPage<Order>>(`${this.baseUrl}/all`, {
      params: toParams({ page, size, status }),
    });
  }

  get(id: string): Observable<Order> {
    return this.http.get<Order>(`${this.baseUrl}/${id}`);
  }

  updateStatus(id: string, status: Exclude<OrderStatus, 'PENDING'>): Observable<Order> {
    return this.http.patch<Order>(`${this.baseUrl}/${id}/status`, { status });
  }
}

@Injectable({ providedIn: 'root' })
export class PaymentsApi {
  private readonly http = inject(HttpClient);
  // O gateway remove /api/payments e o serviço também começa com /payments.
  private readonly baseUrl = `${inject(API_URL)}/api/payments/payments`;

  /** Retorna null quando o pedido ainda não tem pagamento (404). */
  getForOrder(orderId: string): Observable<Payment | null> {
    return this.http.get<Payment>(`${this.baseUrl}/order/${orderId}`).pipe(
      catchError((error: { status?: number }) =>
        error.status === 404 ? of(null) : throwError(() => error),
      ),
    );
  }
}

@Injectable({ providedIn: 'root' })
export class ProductsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_URL)}/api/catalog/products`;

  list(page: number, limit: number, search?: string): Observable<ListResponse<Product>> {
    return this.http.get<ListResponse<Product>>(this.baseUrl, {
      params: toParams({ page, limit, search, includeInactive: true }),
    });
  }

  get(id: string): Observable<Product> {
    return this.http
      .get<{ product: Product }>(`${this.baseUrl}/${id}`)
      .pipe(map((body) => body.product));
  }

  create(input: ProductInput): Observable<Product> {
    return this.http.post<{ product: Product }>(this.baseUrl, input).pipe(map((body) => body.product));
  }

  update(id: string, input: ProductInput): Observable<Product> {
    return this.http
      .patch<{ product: Product }>(`${this.baseUrl}/${id}`, input)
      .pipe(map((body) => body.product));
  }
}

@Injectable({ providedIn: 'root' })
export class UsersApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_URL)}/api/auth/users`;

  list(page: number, limit: number): Observable<ListResponse<User>> {
    return this.http.get<ListResponse<User>>(this.baseUrl, { params: toParams({ page, limit }) });
  }
}

@Injectable({ providedIn: 'root' })
export class NotificationsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_URL)}/api/notifications/notifications`;

  list(limit: number): Observable<Notification[]> {
    return this.http
      .get<{ items: Notification[] }>(this.baseUrl, { params: toParams({ limit }) })
      .pipe(map((body) => body.items));
  }
}
