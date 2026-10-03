import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { ProductPagination } from '../types/Product';

interface PaginationProps {
  pagination: ProductPagination;
  onPageChange: (page: number) => void;
}

export default function Pagination({ pagination, onPageChange }: PaginationProps) {
  const { page, totalPages } = pagination;

  return (
    <nav className="flex items-center justify-between border-t border-ink/15 py-5" aria-label="Paginação de produtos">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-ink transition-colors hover:bg-mist disabled:cursor-not-allowed disabled:opacity-35"
      >
        <ArrowLeft size={16} />
        Anterior
      </button>
      <span className="text-sm tabular-nums text-ink/60" aria-live="polite">
        <strong className="text-ink">{page}</strong> de {Math.max(totalPages, 1)}
      </span>
      <button
        type="button"
        disabled={page >= totalPages || totalPages === 0}
        onClick={() => onPageChange(page + 1)}
        className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-ink transition-colors hover:bg-mist disabled:cursor-not-allowed disabled:opacity-35"
      >
        Próxima
        <ArrowRight size={16} />
      </button>
    </nav>
  );
}
