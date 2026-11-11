import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { NotificationsApi, OrdersApi, ProductsApi, UsersApi } from '../../core/api.services';
import { errorMessage } from '../../core/errors';
import { Notification, Order } from '../../core/models';
import { StatusBadge } from '../../shared/status-badge';

interface Metrics {
  pending: number;
  confirmed: number;
  cancelled: number;
  products: number;
  users: number;
}

@Component({
  selector: 'app-dashboard',
  imports: [CurrencyPipe, DatePipe, RouterLink, StatusBadge],
  template: `
    <header class="page-header">
      <div>
        <p class="eyebrow">Visão geral</p>
        <h1>Painel da loja</h1>
      </div>
      <button type="button" class="btn btn--ghost" (click)="load()">Atualizar</button>
    </header>

    @if (error()) {
      <p class="alert alert--error" role="alert">{{ error() }}</p>
    }

    @if (metrics(); as m) {
      <section class="metrics" aria-label="Indicadores">
        <a class="metric" routerLink="/orders" [queryParams]="{ status: 'PENDING' }">
          <span class="metric__label">Pedidos pendentes</span>
          <strong class="metric__value">{{ m.pending }}</strong>
        </a>
        <a class="metric" routerLink="/orders" [queryParams]="{ status: 'CONFIRMED' }">
          <span class="metric__label">Pedidos confirmados</span>
          <strong class="metric__value metric__value--ok">{{ m.confirmed }}</strong>
        </a>
        <a class="metric" routerLink="/orders" [queryParams]="{ status: 'CANCELLED' }">
          <span class="metric__label">Pedidos cancelados</span>
          <strong class="metric__value metric__value--bad">{{ m.cancelled }}</strong>
        </a>
        <a class="metric" routerLink="/products">
          <span class="metric__label">Produtos</span>
          <strong class="metric__value">{{ m.products }}</strong>
        </a>
        <a class="metric" routerLink="/users">
          <span class="metric__label">Usuários</span>
          <strong class="metric__value">{{ m.users }}</strong>
        </a>
      </section>
    } @else if (!error()) {
      <p class="muted">Carregando indicadores...</p>
    }

    <div class="grid-2">
      <section class="card">
        <h2>Pedidos recentes</h2>
        @if (recentOrders().length === 0) {
          <p class="muted">Nenhum pedido ainda.</p>
        } @else {
          <table class="table">
            <thead>
              <tr><th>Pedido</th><th>Data</th><th>Status</th><th class="num">Total</th></tr>
            </thead>
            <tbody>
              @for (order of recentOrders(); track order.id) {
                <tr>
                  <td><a [routerLink]="['/orders', order.id]" class="mono">#{{ order.id.slice(0, 8) }}</a></td>
                  <td>{{ order.createdAt | date: 'short' }}</td>
                  <td><app-status-badge [status]="order.status" /></td>
                  <td class="num">{{ order.totalAmount | currency: 'BRL' }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
      </section>

      <section class="card">
        <h2>Últimas notificações</h2>
        @if (notifications() === null) {
          <p class="muted">Serviço de notificações indisponível.</p>
        } @else if (notifications()!.length === 0) {
          <p class="muted">Nenhuma notificação desde o último reinício do serviço.</p>
        } @else {
          <ul class="feed">
            @for (notification of notifications(); track notification.id) {
              <li>
                <strong>{{ notification.title }}</strong>
                <span>{{ notification.message }}</span>
                <small class="muted">{{ notification.createdAt | date: 'short' }}</small>
              </li>
            }
          </ul>
        }
      </section>
    </div>
  `,
})
export class Dashboard implements OnInit {
  private readonly ordersApi = inject(OrdersApi);
  private readonly productsApi = inject(ProductsApi);
  private readonly usersApi = inject(UsersApi);
  private readonly notificationsApi = inject(NotificationsApi);

  protected readonly metrics = signal<Metrics | null>(null);
  protected readonly recentOrders = signal<Order[]>([]);
  protected readonly notifications = signal<Notification[] | null>([]);
  protected readonly error = signal('');

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.error.set('');
    const countByStatus = (status: 'PENDING' | 'CONFIRMED' | 'CANCELLED') =>
      this.ordersApi.listAll(0, 1, status).pipe(map((page) => page.totalElements));

    forkJoin({
      pending: countByStatus('PENDING'),
      confirmed: countByStatus('CONFIRMED'),
      cancelled: countByStatus('CANCELLED'),
      products: this.productsApi.list(1, 1).pipe(map((result) => result.pagination.total)),
      users: this.usersApi.list(1, 1).pipe(map((result) => result.pagination.total)),
      recent: this.ordersApi.listAll(0, 6).pipe(map((page) => page.content)),
    }).subscribe({
      next: ({ recent, ...metrics }) => {
        this.metrics.set(metrics);
        this.recentOrders.set(recent);
      },
      error: (error: unknown) => this.error.set(errorMessage(error, 'Não foi possível carregar o painel.')),
    });

    // Notificações são complementares: falhas não afetam o restante do painel.
    this.notificationsApi
      .list(6)
      .pipe(catchError(() => of(null)))
      .subscribe((items) => this.notifications.set(items));
  }
}
