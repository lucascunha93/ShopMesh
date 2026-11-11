import { useState } from 'react';
import { ArrowRight, PackageOpen, ShoppingBag, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ErrorMessage } from '../components/PageMessage';
import QuantityStepper from '../components/QuantityStepper';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import * as ordersService from '../services/orders';
import { formatPrice } from '../utils/format';

function checkoutErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const serverMessage = (error.response?.data as { error?: string } | undefined)?.error;
    if (error.response?.status === 404) {
      return serverMessage
        ? `${serverMessage}. Remova o item da sacola e tente novamente.`
        : 'Um dos produtos não está mais disponível.';
    }
    if (error.response?.status === 503) {
      return 'O catálogo está indisponível no momento. Tente novamente em instantes.';
    }
    if (error.response?.status === 401) {
      return 'Sua sessão expirou. Entre novamente para finalizar o pedido.';
    }
  }
  return 'Não foi possível finalizar o pedido. Tente novamente.';
}

export default function CartPage() {
  const { items, total, itemCount, updateQuantity, removeItem, clear } = useCart();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleCheckout() {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/cart' } });
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const order = await ordersService.createOrder(
        items.map(({ productId, quantity }) => ({ productId, quantity })),
      );
      clear();
      navigate(`/orders/${order.id}`, { state: { justCreated: true } });
    } catch (requestError) {
      setError(checkoutErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <section className="mx-auto flex min-h-[55vh] max-w-7xl flex-col items-center justify-center px-5 text-center sm:px-8">
        <ShoppingBag className="mb-4 text-moss" size={36} strokeWidth={1.4} />
        <h1 className="font-display text-[34px] font-semibold text-ink">Sua sacola está vazia</h1>
        <p className="mt-2 text-sm text-ink/60">Explore o catálogo e escolha seus favoritos.</p>
        <Link to="/" className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-bold text-paper transition-colors hover:bg-moss">
          Explorar produtos <ArrowRight size={16} />
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-12">
      <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-coral">Quase lá</p>
      <h1 className="mb-8 font-display text-[36px] font-semibold text-ink">Sua sacola</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <ul className="divide-y divide-ink/10 border-y border-ink/10">
          {items.map((item) => (
            <li key={item.productId} className="flex flex-wrap items-center gap-4 py-5 sm:flex-nowrap">
              <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-[5px] bg-mist text-ink">
                {item.imageUrl
                  ? <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                  : <PackageOpen size={28} strokeWidth={1.3} />}
              </div>
              <div className="min-w-0 flex-1">
                <Link to={`/products/${item.productId}`} className="line-clamp-2 break-words font-semibold text-ink hover:text-moss">
                  {item.name}
                </Link>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-ink/45">{item.category || 'geral'}</p>
                <p className="mt-1 text-sm tabular-nums text-ink/65">{formatPrice(item.price)} cada</p>
              </div>
              <QuantityStepper
                label={`Quantidade de ${item.name}`}
                value={item.quantity}
                onChange={(value) => updateQuantity(item.productId, value)}
              />
              <p className="w-28 text-right font-semibold tabular-nums text-ink">{formatPrice(item.price * item.quantity)}</p>
              <button
                type="button"
                onClick={() => removeItem(item.productId)}
                className="grid size-10 place-items-center rounded-full text-ink/50 transition-colors hover:bg-[#f8e8e1] hover:text-coral"
                aria-label={`Remover ${item.name} da sacola`}
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>

        <aside className="h-fit rounded-[5px] border border-ink/10 bg-white p-6">
          <h2 className="font-display text-[22px] font-semibold text-ink">Resumo</h2>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between text-ink/65">
              <dt>{itemCount} {itemCount === 1 ? 'item' : 'itens'}</dt>
              <dd className="tabular-nums">{formatPrice(total)}</dd>
            </div>
            <div className="flex justify-between border-t border-ink/10 pt-3 text-base font-bold text-ink">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatPrice(total)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs leading-5 text-ink/50">
            O preço final é confirmado pelo catálogo no momento do pedido.
          </p>
          {error && <div className="mt-4"><ErrorMessage message={error} /></div>}
          <button
            type="button"
            onClick={handleCheckout}
            disabled={submitting}
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-6 text-sm font-bold text-paper transition-colors hover:bg-moss disabled:cursor-wait disabled:opacity-60"
          >
            {submitting ? 'Enviando pedido...' : isAuthenticated ? 'Finalizar pedido' : 'Entrar para finalizar'}
            {!submitting && <ArrowRight size={17} />}
          </button>
        </aside>
      </div>
    </section>
  );
}
