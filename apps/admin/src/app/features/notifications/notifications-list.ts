import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NotificationsApi } from '../../core/api.services';
import { errorMessage } from '../../core/errors';
import { Notification } from '../../core/models';

@Component({
  selector: 'app-notifications-list',
  imports: [DatePipe, RouterLink],
  template: `
    <header class="page-header">
      <div>
        <p class="eyebrow">Eventos</p>
        <h1>Notificações enviadas</h1>
      </div>
      <button type="button" class="btn btn--ghost" (click)="load()">Atualizar</button>
    </header>
    <p class="muted">
      O Notifications Service não tem banco: esta lista contém as notificações em memória desde o último reinício.
    </p>

    @if (error()) {
      <p class="alert alert--error" role="alert">{{ error() }}</p>
    }

    <section class="card card--flush">
      @if (items(); as list) {
        @if (list.length === 0) {
          <p class="muted pad">Nenhuma notificação registrada.</p>
        } @else {
          <table class="table">
            <thead>
              <tr><th>Quando</th><th>Tipo</th><th>Mensagem</th><th>Pedido</th><th>Canal</th></tr>
            </thead>
            <tbody>
              @for (notification of list; track notification.id) {
                <tr>
                  <td>{{ notification.createdAt | date: 'short' }}</td>
                  <td><strong>{{ notification.title }}</strong></td>
                  <td>{{ notification.message }}</td>
                  <td>
                    <a [routerLink]="['/orders', notification.orderId]" class="mono">#{{ notification.orderId.slice(0, 8) }}</a>
                  </td>
                  <td>{{ notification.channel }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
      } @else if (!error()) {
        <p class="muted pad">Carregando notificações...</p>
      }
    </section>
  `,
})
export class NotificationsList implements OnInit {
  private readonly notificationsApi = inject(NotificationsApi);

  protected readonly items = signal<Notification[] | null>(null);
  protected readonly error = signal('');

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.error.set('');
    this.notificationsApi.list(100).subscribe({
      next: (items) => this.items.set(items),
      error: (error: unknown) => this.error.set(errorMessage(error, 'Não foi possível carregar as notificações.')),
    });
  }
}
