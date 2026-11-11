import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ProductsApi } from '../../core/api.services';
import { errorMessage } from '../../core/errors';
import { Product, ProductInput } from '../../core/models';

@Component({
  selector: 'app-product-form',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <a routerLink="/products" class="back">← Produtos</a>
    <header class="page-header">
      <div>
        <p class="eyebrow">Catálogo</p>
        <h1>{{ id() ? 'Editar produto' : 'Novo produto' }}</h1>
      </div>
    </header>

    @if (error()) {
      <p class="alert alert--error" role="alert">{{ error() }}</p>
    }
    @if (saved()) {
      <p class="alert alert--success" role="status">Produto salvo.</p>
    }

    @if (loading()) {
      <p class="muted">Carregando produto...</p>
    } @else {
      <form class="card form" [formGroup]="form" (ngSubmit)="save()">
        <label class="field field--wide">
          <span>Nome</span>
          <input formControlName="name" required />
        </label>
        <label class="field field--wide">
          <span>Descrição</span>
          <textarea formControlName="description" rows="3"></textarea>
        </label>
        <label class="field">
          <span>Preço (R$)</span>
          <input type="number" formControlName="price" min="0" step="0.01" required />
        </label>
        <label class="field">
          <span>Categoria</span>
          <input formControlName="category" placeholder="geral" />
        </label>
        <label class="field">
          <span>Estoque físico</span>
          <input type="number" formControlName="stock" min="0" step="1" required />
          @if (product(); as current) {
            <small class="muted">
              {{ current.reserved ?? 0 }} unidade(s) reservada(s) por pedidos em andamento; o estoque não pode ficar abaixo disso.
            </small>
          }
        </label>
        <label class="field">
          <span>URL da imagem</span>
          <input type="url" formControlName="imageUrl" placeholder="https://..." />
        </label>
        <label class="checkbox field--wide">
          <input type="checkbox" formControlName="active" />
          <span>Produto ativo (visível na loja)</span>
        </label>
        <div class="actions field--wide">
          <button type="submit" class="btn btn--primary" [disabled]="form.invalid || saving()">
            {{ saving() ? 'Salvando...' : 'Salvar' }}
          </button>
          <a routerLink="/products" class="btn btn--ghost">Cancelar</a>
        </div>
      </form>
    }
  `,
})
export class ProductForm implements OnInit {
  /** Parâmetro `:id` da rota de edição; ausente na criação. */
  readonly id = input<string>();

  private readonly productsApi = inject(ProductsApi);
  private readonly router = inject(Router);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required],
    description: [''],
    price: [0, [Validators.required, Validators.min(0)]],
    category: ['geral'],
    stock: [0, [Validators.required, Validators.min(0), Validators.pattern(/^\d+$/)]],
    imageUrl: [''],
    active: [true],
  });

  protected readonly product = signal<Product | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly error = signal('');

  ngOnInit(): void {
    const id = this.id();
    if (!id) {
      return;
    }

    this.loading.set(true);
    this.productsApi.get(id).subscribe({
      next: (product) => {
        this.product.set(product);
        this.form.setValue({
          name: product.name,
          description: product.description ?? '',
          price: product.price,
          category: product.category ?? 'geral',
          stock: product.stock,
          imageUrl: product.imageUrl ?? '',
          active: product.active,
        });
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(errorMessage(error, 'Não foi possível carregar o produto.'));
        this.loading.set(false);
      },
    });
  }

  protected save(): void {
    if (this.form.invalid) {
      return;
    }

    const value = this.form.getRawValue();
    const input: ProductInput = {
      name: value.name.trim(),
      description: value.description,
      price: Number(value.price),
      category: value.category.trim() || 'geral',
      stock: Number(value.stock),
      imageUrl: value.imageUrl.trim() || undefined,
    };

    this.saving.set(true);
    this.saved.set(false);
    this.error.set('');

    const id = this.id();
    // O endpoint de criação não aceita "active": produtos novos nascem ativos.
    const request = id
      ? this.productsApi.update(id, { ...input, active: value.active })
      : this.productsApi.create(input);

    request.subscribe({
      next: (product) => {
        this.saving.set(false);
        if (id) {
          this.product.set(product);
          this.saved.set(true);
        } else {
          this.router.navigate(['/products', product._id, 'edit']);
        }
      },
      error: (error: unknown) => {
        this.error.set(errorMessage(error, 'Não foi possível salvar o produto.'));
        this.saving.set(false);
      },
    });
  }
}
