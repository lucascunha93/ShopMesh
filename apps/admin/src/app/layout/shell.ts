import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="shell">
      <aside class="sidebar">
        <a routerLink="/" class="brand" aria-label="Painel ShopMesh">
          <span class="brand__mark">S</span>
          <span>shopmesh <small>admin</small></span>
        </a>
        <nav class="nav" aria-label="Navegação do painel">
          <a routerLink="/" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: true }">Visão geral</a>
          <a routerLink="/orders" routerLinkActive="is-active">Pedidos</a>
          <a routerLink="/products" routerLinkActive="is-active">Produtos</a>
          <a routerLink="/users" routerLinkActive="is-active">Usuários</a>
          <a routerLink="/notifications" routerLinkActive="is-active">Notificações</a>
        </nav>
        <div class="sidebar__footer">
          <p class="muted">{{ auth.user()?.name }}</p>
          <p class="muted small">{{ auth.user()?.email }}</p>
          <button type="button" class="btn btn--ghost btn--block" (click)="logout()">Sair</button>
        </div>
      </aside>
      <main class="content">
        <router-outlet />
      </main>
    </div>
  `,
})
export class Shell {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
