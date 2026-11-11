import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { OrdersApi } from '../../core/api.services';
import { errorMessage } from '../../core/errors';
import { Order, OrderStatus, SpringPage } from '../../core/models';
import { Pager } from '../../shared/pager';
import { StatusBadge } from '../../shared/status-badge';

const PAGE_SIZE = 15;
const STATUSES: OrderStatus[] = ['PENDING', 'CONFIRMED', 'CANCELLED'];

@Component({
  selector: 'app-orders-list',
  imports: [CurrencyPipe, DatePipe, RouterLink, Pager, StatusBadge],
  template: `
    <header class="page-header">
      <div>
        <p class="eyebrow">Operação</p>
        <h1>Pedidos</h1>
      </div>
    </header>

    <div class="tabs" role="tablist" aria-label="Filtrar por status">
      @for (filter of filters; track filter.label) {
        <a
          role="tab"
          [routerLink]="[]"
          [queryParams]="{ status: filter.value, page: null }"
          [class.is-active]="status() === filter.value"
          [attr.aria-selected]="status() === filter.value"
        >
          {{ filter.label }}
        </a>
      }
    </div>

    @if (error()) {
      <p class="alert alert--error" role="alert">{{ error() }}</p>
    }

    <section class="card card--flush">
      @if (loading()) {
        <p class="muted pad">Carregando pedidos...</p>
      } @else if (result(); as page) {
        @if (page.content.length === 0) {
          <p class="muted pad">Nenhum pedido encontrado.</p>
        } @else {
          <table class="table">
            <thead>
              <tr>
                <th>Pedido</th><th>Cliente</th><th>Criado em</th><th>Itens</th><th>Status</th><th class="num">Total</th>
              </tr>
            </thead>
            <tbody>
              @for (order of page.content; track order.id) {
                <tr class="clickable" (click)="open(order)">
                  <td><a [routerLink]="['/orders', order.id]" class="mono">#{{ order.id.slice(0, 8) }}</a></td>
                  <td class="mono muted">{{ order.userId.slice(0, 8) }}</td>
                  <td>{{ order.createdAt | date: 'short' }}</td>
                  <td>{{ order.items.length }}</td>
                  <td>
                    <app-status-badge [status]="order.status" />
                    @if (order.statusReason) {
                      <div class="small muted reason">{{ order.statusReason }}</div>
                    }
                  </td>
                  <td class="num">{{ order.totalAmount | currency: 'BRL' }}</td>
                </tr>
              }
            </tbody>
          </table>
          <app-pager [page]="page.number + 1" [totalPages]="page.totalPages" (pageChange)="goToPage($event)" />
        }
      }
    </section>
  `,
})
export class OrdersList {
  private readonly ordersApi = inject(OrdersApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly filters: { label: string; value: OrderStatus | null }[] = [
    { label: 'Todos', value: null },
    { label: 'Pendentes', value: 'PENDING' },
    { label: 'Confirmados', value: 'CONFIRMED' },
    { label: 'Cancelados', value: 'CANCELLED' },
  ];

  protected readonly status = signal<OrderStatus | null>(null);
  protected readonly result = signal<SpringPage<Order> | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  constructor() {
    // O filtro e a página ficam na URL para que possam ser compartilhados.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((query) => {
      const statusParam = query.get('status') as OrderStatus | null;
      const status = statusParam && STATUSES.includes(statusParam) ? statusParam : null;
      const page = Math.max(Number(query.get('page')) || 1, 1);
      this.status.set(status);
      this.load(page, status);
    });
  }

  protected goToPage(page: number): void {
    this.router.navigate([], { queryParams: { page }, queryParamsHandling: 'merge' });
  }

  protected open(order: Order): void {
    this.router.navigate(['/orders', order.id]);
  }

  private load(page: number, status: OrderStatus | null): void {
    this.loading.set(true);
    this.error.set('');
    this.ordersApi.listAll(page - 1, PAGE_SIZE, status).subscribe({
      next: (result) => {
        this.result.set(result);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(errorMessage(error, 'Não foi possível carregar os pedidos.'));
        this.loading.set(false);
      },
    });
  }
}
