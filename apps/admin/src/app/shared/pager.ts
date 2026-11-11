import { Component, input, output } from '@angular/core';

/** Paginação simples; `page` começa em 1 para exibição. */
@Component({
  selector: 'app-pager',
  template: `
    @if (totalPages() > 1) {
      <nav class="pager" aria-label="Paginação">
        <button type="button" class="btn btn--ghost" [disabled]="page() <= 1" (click)="pageChange.emit(page() - 1)">
          ← Anterior
        </button>
        <span>Página <strong>{{ page() }}</strong> de {{ totalPages() }}</span>
        <button
          type="button"
          class="btn btn--ghost"
          [disabled]="page() >= totalPages()"
          (click)="pageChange.emit(page() + 1)"
        >
          Próxima →
        </button>
      </nav>
    }
  `,
})
export class Pager {
  readonly page = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly pageChange = output<number>();
}
