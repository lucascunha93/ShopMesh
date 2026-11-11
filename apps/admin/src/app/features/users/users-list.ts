import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { UsersApi } from '../../core/api.services';
import { errorMessage } from '../../core/errors';
import { ListResponse, User } from '../../core/models';
import { Pager } from '../../shared/pager';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-users-list',
  imports: [DatePipe, Pager],
  template: `
    <header class="page-header">
      <div>
        <p class="eyebrow">Contas</p>
        <h1>Usuários</h1>
      </div>
    </header>

    @if (error()) {
      <p class="alert alert--error" role="alert">{{ error() }}</p>
    }

    <section class="card card--flush">
      @if (result(); as list) {
        <table class="table">
          <thead>
            <tr><th>Nome</th><th>Email</th><th>Perfil</th><th>Criado em</th><th>ID</th></tr>
          </thead>
          <tbody>
            @for (user of list.items; track user.id) {
              <tr>
                <td>{{ user.name }}</td>
                <td>{{ user.email }}</td>
                <td>
                  <span [class]="user.role === 'ADMIN' ? 'badge badge--pending' : 'badge badge--muted'">
                    {{ user.role === 'ADMIN' ? 'Administrador' : 'Cliente' }}
                  </span>
                </td>
                <td>{{ user.createdAt | date: 'short' }}</td>
                <td class="mono muted">{{ user.id.slice(0, 8) }}</td>
              </tr>
            }
          </tbody>
        </table>
        <app-pager [page]="list.pagination.page" [totalPages]="list.pagination.totalPages" (pageChange)="load($event)" />
      } @else if (!error()) {
        <p class="muted pad">Carregando usuários...</p>
      }
    </section>
  `,
})
export class UsersList implements OnInit {
  private readonly usersApi = inject(UsersApi);

  protected readonly result = signal<ListResponse<User> | null>(null);
  protected readonly error = signal('');

  ngOnInit(): void {
    this.load(1);
  }

  protected load(page: number): void {
    this.error.set('');
    this.usersApi.list(page, PAGE_SIZE).subscribe({
      next: (result) => this.result.set(result),
      error: (error: unknown) => this.error.set(errorMessage(error, 'Não foi possível carregar os usuários.')),
    });
  }
}
