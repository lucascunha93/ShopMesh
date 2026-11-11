import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Bell, ChevronRight, Receipt } from 'lucide-react';
import { Link } from 'react-router-dom';
import OrderStatusBadge from '../components/OrderStatusBadge';
import { ErrorMessage, LoadingMessage } from '../components/PageMessage';
import * as notificationsService from '../services/notifications';
import * as ordersService from '../services/orders';
import type { Notification } from '../types/Notification';
import type { Order, Page } from '../types/Order';
import { formatDate, formatPrice, shortId } from '../utils/format';

const pageSize = 10;

export default function OrdersPage() {
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<Page<Order> | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');

    ordersService.listMyOrders(page, pageSize, controller.signal)
      .then(setResult)
      .catch(() => {
        if (!controller.signal.aborted) {
          setError('Não foi possível carregar seus pedidos.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [page]);

  useEffect(() => {
    const controller = new AbortController();
    // As notificações são um complemento: se o serviço estiver fora, a página segue funcionando.
    notificationsService.listMyNotifications(8, controller.signal)
      .then(setNotifications)
      .catch(() => setNotifications([]));
    return () => controller.abort();
  }, []);

  return (
    <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-12">
      <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-coral">Sua conta</p>
      <h1 className="mb-8 font-display text-[36px] font-semibold text-ink">Meus pedidos</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          {error && <ErrorMessage message={error} />}
          {loading ? (
            <LoadingMessage label="Buscando pedidos" />
          ) : result && result.content.length > 0 ? (
            <>
              <ul className="divide-y divide-ink/10 border-y border-ink/10">
                {result.content.map((order) => (
                  <li key={order.id}>
                    <Link to={`/orders/${order.id}`} className="group flex flex-wrap items-center gap-x-6 gap-y-2 py-5 transition-colors hover:bg-white sm:px-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-ink">Pedido #{shortId(order.id)}</p>
                        <p className="mt-1 text-sm text-ink/55">
                          {formatDate(order.createdAt)} · {order.items.length} {order.items.length === 1 ? 'item' : 'itens'}
                        </p>
                      </div>
                      <OrderStatusBadge status={order.status} />
                      <p className="w-28 text-right font-semibold tabular-nums text-ink">{formatPrice(order.totalAmount)}</p>
                      <ChevronRight size={18} className="text-ink/35 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </li>
                ))}
              </ul>
              {result.totalPages > 1 && (
                <nav className="flex items-center justify-between py-5" aria-label="Paginação de pedidos">
                  <button
                    type="button"
                    disabled={page === 0}
                    onClick={() => setPage(page - 1)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-ink hover:bg-mist disabled:opacity-35"
                  >
                    <ArrowLeft size={16} /> Anteriores
                  </button>
                  <span className="text-sm tabular-nums text-ink/60">{page + 1} de {result.totalPages}</span>
                  <button
                    type="button"
                    disabled={page + 1 >= result.totalPages}
                    onClick={() => setPage(page + 1)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-ink hover:bg-mist disabled:opacity-35"
                  >
                    Mais antigos <ArrowRight size={16} />
                  </button>
                </nav>
              )}
            </>
          ) : !error ? (
            <div className="flex min-h-64 flex-col items-center justify-center border border-dashed border-ink/20 text-center">
              <Receipt className="mb-4 text-moss" size={34} strokeWidth={1.4} />
              <h2 className="font-display text-2xl font-semibold text-ink">Você ainda não fez pedidos</h2>
              <Link to="/" className="mt-4 text-sm font-bold text-ink underline underline-offset-4">Explorar o catálogo</Link>
            </div>
          ) : null}
        </div>

        <aside className="h-fit rounded-[5px] border border-ink/10 bg-white p-6" aria-labelledby="notifications-heading">
          <h2 id="notifications-heading" className="flex items-center gap-2 font-display text-[20px] font-semibold text-ink">
            <Bell size={17} className="text-coral" /> Atualizações
          </h2>
          {notifications.length === 0 ? (
            <p className="mt-4 text-sm text-ink/55">As novidades dos seus pedidos aparecem aqui.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {notifications.map((notification) => (
                <li key={notification.id} className="border-l-2 border-leaf pl-3">
                  <Link to={`/orders/${notification.orderId}`} className="block hover:text-moss">
                    <p className="text-sm font-semibold text-ink">{notification.title}</p>
                    <p className="mt-0.5 text-xs leading-5 text-ink/60">{notification.message}</p>
                    <p className="mt-1 text-[11px] text-ink/40">{formatDate(notification.createdAt)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </section>
  );
}
