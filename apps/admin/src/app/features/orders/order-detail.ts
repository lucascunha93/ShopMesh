import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { OrdersApi, PaymentsApi } from '../../core/api.services';
import { errorMessage } from '../../core/errors';
import { Order, Payment } from '../../core/models';
import { StatusBadge } from '../../shared/status-badge';

@Component({
  selector: 'app-order-detail',
  imports: [CurrencyPipe, DatePipe, RouterLink, StatusBadge],
  template: `
    <a routerLink="/orders" class="back">← Pedidos</a>

    @if (error()) {
      <p class="alert alert--error" role="alert">{{ error() }}</p>
    }

    @if (order(); as current) {
      <header class="page-header">
        <div>
          <p class="eyebrow mono">Pedido #{{ current.id.slice(0, 8) }}</p>
          <h1>{{ current.totalAmount | currency: 'BRL' }}</h1>
        </div>
        <app-status-badge [status]="current.status" />
      </header>

      @if (current.status === 'PENDING') {
        <section class="card card--warning">
          <p>
            Este pedido ainda está na Saga (reserva de estoque e pagamento). Uma ação manual encerra o pedido
            no Orders Service, mas não desfaz reservas ou cobranças já feitas pelos outros serviços.
          </p>
          <div class="actions">
            <button type="button" class="btn btn--primary" [disabled]="saving()" (click)="update('CONFIRMED')">
              Confirmar pedido
            </button>
            <button type="button" class="btn btn--danger" [disabled]="saving()" (click)="update('CANCELLED')">
              Cancelar pedido
            </button>
          </div>
        </section>
      }

      <div class="grid-2">
        <section class="card">
          <h2>Resumo</h2>
          <dl class="details">
            <dt>ID completo</dt><dd class="mono">{{ current.id }}</dd>
            <dt>Cliente</dt><dd class="mono">{{ current.userId }}</dd>
            <dt>Criado em</dt><dd>{{ current.createdAt | date: 'medium' }}</dd>
            <dt>Atualizado em</dt><dd>{{ current.updatedAt | date: 'medium' }}</dd>
            @if (current.statusReason) {
              <dt>Motivo</dt><dd>{{ current.statusReason }}</dd>
            }
          </dl>
        </section>

        <section class="card">
          <h2>Pagamento</h2>
          @if (payment(); as currentPayment) {
            <dl class="details">
              <dt>Status</dt>
              <dd>
                <span [class]="currentPayment.status === 'APPROVED' ? 'badge badge--confirmed' : 'badge badge--cancelled'">
                  {{ currentPayment.status === 'APPROVED' ? 'Aprovado' : 'Rejeitado' }}
                </span>
              </dd>
              <dt>Valor</dt><dd>{{ currentPayment.amount | currency: 'BRL' }}</dd>
              <dt>ID</dt><dd class="mono">{{ currentPayment.id }}</dd>
              @if (currentPayment.reason) {
                <dt>Motivo</dt><dd>{{ currentPayment.reason }}</dd>
              }
            </dl>
          } @else {
            <p class="muted">
              Nenhum pagamento registrado. Pedidos cancelados por falta de estoque não chegam a ser cobrados.
            </p>
          }
        </section>
      </div>

      <section class="card card--flush">
        <h2 class="pad">Itens</h2>
        <table class="table">
          <thead>
            <tr><th>Produto</th><th class="num">Preço</th><th class="num">Qtd.</th><th class="num">Subtotal</th></tr>
          </thead>
          <tbody>
            @for (item of current.items; track item.id) {
              <tr>
                <td>
                  <a [routerLink]="['/products', item.productId, 'edit']">{{ item.productName }}</a>
                  <div class="small muted mono">{{ item.productId }}</div>
                </td>
                <td class="num">{{ item.unitPrice | currency: 'BRL' }}</td>
                <td class="num">{{ item.quantity }}</td>
                <td class="num">{{ item.subtotal | currency: 'BRL' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </section>
    } @else if (!error()) {
      <p class="muted">Carregando pedido...</p>
    }
  `,
})
export class OrderDetail implements OnInit {
  /** Vinculado ao parâmetro de rota `:id` (withComponentInputBinding). */
  readonly id = input.required<string>();

  private readonly ordersApi = inject(OrdersApi);
  private readonly paymentsApi = inject(PaymentsApi);

  protected readonly order = signal<Order | null>(null);
  protected readonly payment = signal<Payment | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal('');

  ngOnInit(): void {
    forkJoin({
      order: this.ordersApi.get(this.id()),
      payment: this.paymentsApi.getForOrder(this.id()),
    }).subscribe({
      next: ({ order, payment }) => {
        this.order.set(order);
        this.payment.set(payment);
      },
      error: (error: unknown) => this.error.set(errorMessage(error, 'Não foi possível carregar o pedido.')),
    });
  }

  protected update(status: 'CONFIRMED' | 'CANCELLED'): void {
    const action = status === 'CONFIRMED' ? 'confirmar' : 'cancelar';
    if (!confirm(`Deseja ${action} este pedido manualmente?`)) {
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.ordersApi.updateStatus(this.id(), status).subscribe({
      next: (order) => {
        this.order.set(order);
        this.saving.set(false);
      },
      error: (error: unknown) => {
        this.error.set(errorMessage(error, 'Não foi possível atualizar o pedido.'));
        this.saving.set(false);
      },
    });
  }
}
