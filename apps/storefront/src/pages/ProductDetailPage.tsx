import { useEffect, useState } from 'react';
import { ArrowLeft, Check, PackageOpen, ShoppingBag } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ErrorMessage, LoadingMessage } from '../components/PageMessage';
import QuantityStepper from '../components/QuantityStepper';
import { useCart } from '../context/CartContext';
import * as productsService from '../services/products';
import type { Product } from '../types/Product';
import { availableStock, formatPrice } from '../utils/format';

export default function ProductDetailPage() {
  const { id = '' } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const { addItem, items } = useCart();

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setQuantity(1);
    setAdded(false);

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

  const currentProduct = product;
  const available = availableStock(currentProduct);
  const inCart = items.find((item) => item.productId === currentProduct._id)?.quantity ?? 0;
  const maxToAdd = Math.max(available - inCart, 0);
  const stepperMax = Math.max(maxToAdd, 1);

  function handleAdd() {
    if (maxToAdd === 0) {
      return;
    }
    addItem(currentProduct, Math.min(quantity, maxToAdd));
    setQuantity(1);
    setAdded(true);
  }

  let addLabel = 'Adicionar à sacola';
  if (available === 0) {
    addLabel = 'Esgotado';
  } else if (maxToAdd === 0) {
    addLabel = 'Limite na sacola';
  }

  return (
    <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
      <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-ink/65 transition-colors hover:text-ink">
        <ArrowLeft size={16} /> Voltar ao catálogo
      </Link>
      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <div className="relative aspect-[4/3] min-w-0 overflow-hidden rounded-[5px] bg-mist">
          {currentProduct.imageUrl ? (
            <img src={currentProduct.imageUrl} alt={currentProduct.name} className="h-full w-full object-cover" />
          ) : (
            <div className="product-detail-visual grid h-full place-items-center bg-[#dce8c7]">
              <span className="relative grid size-32 place-items-center rounded-[34px] bg-white/65 text-ink shadow-[0_24px_60px_-32px_rgba(23,61,53,0.55)]">
                <PackageOpen size={54} strokeWidth={1.2} />
              </span>
            </div>
          )}
          <span className="absolute left-5 top-5 rounded-full bg-paper px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-ink">{currentProduct.category || 'geral'}</span>
        </div>

        <div className="flex min-w-0 flex-col justify-center py-2 lg:py-8">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-coral">ShopMesh seleciona</p>
          <h1 className="break-words font-display text-[38px] font-semibold leading-tight text-ink sm:text-[48px]">{currentProduct.name}</h1>
          <p className="mt-5 text-[26px] font-semibold tabular-nums text-ink">{formatPrice(currentProduct.price)}</p>
          <p className="mt-6 max-w-xl text-[15px] leading-7 text-ink/65">
            {currentProduct.description || 'Uma escolha versátil para acompanhar seus dias.'}
          </p>
          <div className="my-8 h-px w-full bg-ink/15" />
          <div className="flex flex-wrap items-center gap-x-7 gap-y-3 text-sm text-ink/65">
            <span className="inline-flex items-center gap-2">
              <Check size={16} className="text-moss" /> {available > 0 ? `${available} disponíveis` : 'Esgotado no momento'}
            </span>
            <span>Categoria: <strong className="font-semibold text-ink">{currentProduct.category || 'geral'}</strong></span>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <QuantityStepper
              label="Quantidade"
              value={Math.min(quantity, stepperMax)}
              max={stepperMax}
              onChange={(value) => {
                setQuantity(value);
                setAdded(false);
              }}
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={maxToAdd === 0}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-6 text-sm font-bold text-paper transition-colors hover:bg-moss disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ShoppingBag size={16} />
              {addLabel}
            </button>
          </div>
          {added && (
            <p className="mt-4 text-sm text-moss" role="status">
              Adicionado à sacola. <Link to="/cart" className="font-bold underline underline-offset-4">Ver sacola</Link>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
