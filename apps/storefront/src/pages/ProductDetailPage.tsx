import { useEffect, useState } from 'react';
import { ArrowLeft, Check, PackageOpen } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ErrorMessage, LoadingMessage } from '../components/PageMessage';
import * as productsService from '../services/products';
import type { Product } from '../types/Product';

function formatPrice(price: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);
}

export default function ProductDetailPage() {
  const { id = '' } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');

    productsService.getProduct(id, controller.signal)
      .then(setProduct)
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          const status = typeof requestError === 'object' && requestError !== null && 'response' in requestError
            ? (requestError as { response?: { status?: number } }).response?.status
            : undefined;
          setError(status === 404 ? 'Este produto não foi encontrado.' : 'Não foi possível carregar os detalhes do produto.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [id]);

  if (loading) {
    return <div className="mx-auto max-w-7xl px-5 sm:px-8"><LoadingMessage label="Carregando produto" /></div>;
  }

  if (error || !product) {
    return (
      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-ink hover:text-moss">
          <ArrowLeft size={16} /> Voltar ao catálogo
        </Link>
        <ErrorMessage message={error || 'Este produto não foi encontrado.'} />
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
      <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-ink/65 transition-colors hover:text-ink">
        <ArrowLeft size={16} /> Voltar ao catálogo
      </Link>
      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <div className="relative aspect-[4/3] min-w-0 overflow-hidden rounded-[5px] bg-mist">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="product-detail-visual grid h-full place-items-center bg-[#dce8c7]">
              <span className="relative grid size-32 place-items-center rounded-[34px] bg-white/65 text-ink shadow-[0_24px_60px_-32px_rgba(23,61,53,0.55)]">
                <PackageOpen size={54} strokeWidth={1.2} />
              </span>
            </div>
          )}
          <span className="absolute left-5 top-5 rounded-full bg-paper px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-ink">{product.category || 'geral'}</span>
        </div>

        <div className="flex min-w-0 flex-col justify-center py-2 lg:py-8">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-coral">ShopMesh seleciona</p>
          <h1 className="break-words font-display text-[38px] font-semibold leading-tight text-ink sm:text-[48px]">{product.name}</h1>
          <p className="mt-5 text-[26px] font-semibold tabular-nums text-ink">{formatPrice(product.price)}</p>
          <p className="mt-6 max-w-xl text-[15px] leading-7 text-ink/65">
            {product.description || 'Uma escolha versátil para acompanhar seus dias.'}
          </p>
          <div className="my-8 h-px w-full bg-ink/15" />
          <div className="flex flex-wrap items-center gap-x-7 gap-y-3 text-sm text-ink/65">
            <span className="inline-flex items-center gap-2"><Check size={16} className="text-moss" /> {product.stock > 0 ? `${product.stock} disponíveis` : 'Consulte disponibilidade'}</span>
            <span>Categoria: <strong className="font-semibold text-ink">{product.category || 'geral'}</strong></span>
          </div>
        </div>
      </div>
    </section>
  );
}
