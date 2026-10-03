import { useEffect, useState } from 'react';
import { ArrowDownRight, PackageSearch, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import Pagination from '../components/Pagination';
import { ErrorMessage, LoadingMessage } from '../components/PageMessage';
import ProductCard from '../components/ProductCard';
import * as productsService from '../services/products';
import type { ProductListResponse } from '../types/Product';

const pageSize = 12;

export default function ProductListPage() {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<ProductListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');

    productsService.listProducts(page, pageSize, controller.signal)
      .then(setResult)
      .catch(() => {
        if (!controller.signal.aborted) {
          setError('Não foi possível carregar os produtos. Verifique se o API Gateway está disponível.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [page]);

  return (
    <div>
      <section className="relative overflow-hidden border-b border-ink/10 bg-[#e8eee8]">
        <div className="catalog-pattern pointer-events-none absolute inset-y-0 right-0 hidden w-[38%] opacity-70 lg:block" />
        <div className="relative mx-auto flex max-w-7xl flex-col justify-between gap-7 px-5 py-10 sm:px-8 sm:py-14 lg:min-h-[260px] lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <p className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-moss">
              <Sparkles size={14} /> Catálogo ShopMesh <span className="h-px w-8 bg-moss/50" /> edição 01
            </p>
            <h1 className="font-display text-[38px] font-semibold leading-[1.08] text-ink sm:text-[52px]">
              Boas escolhas,<br className="hidden sm:block" /> para todos os dias.
            </h1>
            <p className="mt-4 max-w-lg text-[15px] leading-6 text-ink/65">
              Objetos, ideias e pequenos favoritos para deixar a rotina mais sua.
            </p>
          </div>
          <Link to="/" className="inline-flex items-center gap-2 self-start text-sm font-semibold text-ink lg:self-end">
            Ver seleção <ArrowDownRight size={17} className="text-coral" />
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-16 pt-9 sm:px-8 sm:pt-12" aria-labelledby="products-heading">
        <div className="mb-6 flex items-end justify-between gap-4 border-b border-ink/15 pb-4">
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-coral">Feito para descobrir</p>
            <h2 id="products-heading" className="font-display text-[27px] font-semibold text-ink">Produtos em destaque</h2>
          </div>
          <p className="hidden pb-1 text-sm text-ink/55 sm:block" aria-live="polite">
            {result ? `${result.pagination.total} itens` : 'Seleção atual'}
          </p>
        </div>

        {error && <ErrorMessage message={error} />}
        {loading ? (
          <LoadingMessage label="Buscando produtos" />
        ) : result && result.items.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
              {result.items.map((product, index) => (
                <ProductCard key={product._id} product={product} index={index} />
              ))}
            </div>
            <div className="mt-8">
              <Pagination pagination={result.pagination} onPageChange={setPage} />
            </div>
          </>
        ) : !error ? (
          <div className="flex min-h-64 flex-col items-center justify-center border border-dashed border-ink/20 text-center">
            <PackageSearch className="mb-4 text-moss" size={34} strokeWidth={1.4} />
            <h3 className="font-display text-2xl font-semibold text-ink">Ainda não há produtos por aqui</h3>
            <p className="mt-2 text-sm text-ink/55">Volte em breve para descobrir novidades.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
