import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductsApi } from '../../core/api.services';
import { errorMessage } from '../../core/errors';
import { ListResponse, Product } from '../../core/models';
import { Pager } from '../../shared/pager';

const PAGE_SIZE = 15;

@Component({
  selector: 'app-products-list',
  imports: [CurrencyPipe, FormsModule, RouterLink, Pager],
  template: `
    <header class="page-header">
      <div>
        <p class="eyebrow">Catálogo</p>
        <h1>Produtos</h1>
      </div>
      <a routerLink="/products/new" class="btn btn--primary">Novo produto</a>
    </header>

    <form class="toolbar" (ngSubmit)="search()">
      <input type="search" name="search" [(ngModel)]="searchTerm" placeholder="Buscar por nome ou descrição" />
      <button type="submit" class="btn btn--ghost">Buscar</button>
    </form>

    @if (error()) {
      <p class="alert alert--error" role="alert">{{ error() }}</p>
    }

    <section class="card card--flush">
      @if (loading()) {
        <p class="muted pad">Carregando produtos...</p>
      } @else if (result(); as list) {
        @if (list.items.length === 0) {
          <p class="muted pad">Nenhum produto encontrado.</p>
        } @else {
          <table class="table">
            <thead>
              <tr>
                <th>Produto</th><th>Categoria</th><th class="num">Preço</th>
                <th class="num">Estoque</th><th class="num">Reservado</th><th class="num">Disponível</th>
                <th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              @for (product of list.items; track product._id) {
                <tr [class.is-muted]="!product.active">
                  <td>
                    <a [routerLink]="['/products', product._id, 'edit']">{{ product.name }}</a>
                  </td>
                  <td>{{ product.category }}</td>
                  <td class="num">{{ product.price | currency: 'BRL' }}</td>
                  <td class="num">{{ product.stock }}</td>
                  <td class="num">{{ product.reserved ?? 0 }}</td>
                  <td class="num" [class.text-bad]="(product.availableStock ?? product.stock) === 0">
                    {{ product.availableStock ?? product.stock }}
                  </td>
                  <td>
                    <span [class]="product.active ? 'badge badge--confirmed' : 'badge badge--muted'">
                      {{ product.active ? 'Ativo' : 'Inativo' }}
                    </span>
                  </td>
                  <td class="num">
                    <button
                      type="button"
                      class="btn btn--ghost btn--small"
                      [disabled]="busyId() === product._id"
                      (click)="toggleActive(product)"
                    >
                      {{ product.active ? 'Desativar' : 'Ativar' }}
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
          <app-pager [page]="list.pagination.page" [totalPages]="list.pagination.totalPages" (pageChange)="goToPage($event)" />
        }
      }
    </section>
  `,
})
export class ProductsList {
  private readonly productsApi = inject(ProductsApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected searchTerm = '';
  protected readonly result = signal<ListResponse<Product> | null>(null);
  protected readonly loading = signal(true);
  protected readonly busyId = signal<string | null>(null);
  protected readonly error = signal('');

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((query) => {
      this.searchTerm = query.get('search') ?? '';
      this.load(Math.max(Number(query.get('page')) || 1, 1), this.searchTerm);
    });
  }

  protected search(): void {
    this.router.navigate([], { queryParams: { search: this.searchTerm.trim() || null, page: null } });
  }

  protected goToPage(page: number): void {
    this.router.navigate([], { queryParams: { page }, queryParamsHandling: 'merge' });
  }

  protected toggleActive(product: Product): void {
    this.busyId.set(product._id);
    this.error.set('');
    this.productsApi.update(product._id, { active: !product.active }).subscribe({
      next: (updated) => {
        this.result.update((current) =>
          current
            ? { ...current, items: current.items.map((item) => (item._id === updated._id ? updated : item)) }
            : current,
        );
        this.busyId.set(null);
      },
      error: (error: unknown) => {
        this.error.set(errorMessage(error, 'Não foi possível atualizar o produto.'));
        this.busyId.set(null);
      },
    });
  }

  private load(page: number, search: string): void {
    this.loading.set(true);
    this.error.set('');
    this.productsApi.list(page, PAGE_SIZE, search || undefined).subscribe({
      next: (result) => {
        this.result.set(result);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(errorMessage(error, 'Não foi possível carregar os produtos.'));
        this.loading.set(false);
      },
    });
  }
}
