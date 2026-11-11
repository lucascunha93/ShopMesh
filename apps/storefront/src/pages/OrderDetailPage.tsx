import { useEffect, useState, type ReactElement } from 'react';
import { ArrowLeft, Check, Circle, LoaderCircle, X } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';
import axios from 'axios';
import OrderStatusBadge from '../components/OrderStatusBadge';
import { ErrorMessage, LoadingMessage } from '../components/PageMessage';
import * as ordersService from '../services/orders';
import type { Order, Payment } from '../types/Order';
import { formatDate, formatPrice, shortId } from '../utils/format';

const POLL_INTERVAL_MS = 1500;
const MAX_POLL_ATTEMPTS = 40;

type StepState = 'done' | 'current' | 'failed' | 'todo';

interface SagaStep {
  label: string;
  description: string;
  state: StepState;
}

// Reconstrói as etapas da Saga a partir do que o cliente consegue observar:
// o status do pedido e a existência/resultado do pagamento.
function buildSteps(order: Order, payment: Payment | null): SagaStep[] {
  const cancelledBeforePayment = order.status === 'CANCELLED' && !payment;
  const stockState: StepState = cancelledBeforePayment ? 'failed' : payment || order.status === 'CONFIRMED' ? 'done' : 'current';

  let paymentState: StepState = 'todo';
  if (payment) {
    paymentState = payment.status === 'APPROVED' ? 'done' : 'failed';
  } else if (stockState === 'done') {
    paymentState = 'current';
  }

  let confirmationState: StepState = 'todo';
  if (order.status === 'CONFIRMED') {
    confirmationState = 'done';
  } else if (order.status === 'CANCELLED') {
    confirmationState = 'failed';
  } else if (paymentState === 'done') {
    confirmationState = 'current';
  }

  return [
    { label: 'Pedido recebido', description: formatDate(order.createdAt), state: 'done' },
    {
      label: 'Estoque reservado',
      description: stockState === 'failed' ? order.statusReason || 'Estoque indisponível' : 'Itens separados para você',
      state: stockState,
    },
    {
      label: 'Pagamento',
      description: payment
        ? payment.status === 'APPROVED' ? `Aprovado · ${formatPrice(payment.amount)}` : payment.reason || 'Pagamento recusado'
        : 'Aguardando processamento',
      state: paymentState,
    },
    {
      label: order.status === 'CANCELLED' ? 'Pedido cancelado' : 'Pedido confirmado',
      description: order.status === 'CANCELLED' ? 'Nenhum valor foi cobrado sem os itens reservados.' : 'Tudo certo com seu pedido',
      state: confirmationState,
    },
  ];
}

const stepIcon: Record<StepState, ReactElement> = {
  done: <Check size={14} />,
  current: <LoaderCircle size={14} className="animate-spin" />,
  failed: <X size={14} />,
  todo: <Circle size={10} />,
};

const stepStyle: Record<StepState, string> = {
  done: 'bg-moss text-white',
  current: 'bg-leaf text-ink',
  failed: 'bg-coral text-white',
  todo: 'bg-mist text-ink/40',
};

export default function OrderDetailPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const justCreated = Boolean((location.state as { justCreated?: boolean } | null)?.justCreated);
  const [order, setOrder] = useState<Order | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    let timer: number | undefined;
    let attempts = 0;
    setOrder(null);
    setPayment(null);
    setError('');

    async function load() {
      try {
        const loadedOrder = await ordersService.getOrder(id, controller.signal);
        const loadedPayment = await ordersService.getPaymentForOrder(id, controller.signal);
        if (controller.signal.aborted) {
          return;
        }
        setOrder(loadedOrder);
        setPayment(loadedPayment);

        // Enquanto a Saga estiver em andamento, consulta novamente.
        attempts += 1;
        if (loadedOrder.status === 'PENDING' && attempts < MAX_POLL_ATTEMPTS) {
          timer = window.setTimeout(load, POLL_INTERVAL_MS);
        }
      } catch (requestError) {
        if (controller.signal.aborted) {
          return;
        }
        if (axios.isAxiosError(requestError) && requestError.response?.status === 404) {
          setError('Pedido não encontrado.');
        } else if (axios.isAxiosError(requestError) && requestError.response?.status === 403) {
          setError('Este pedido pertence a outra conta.');
        } else {
          setError('Não foi possível carregar o pedido.');
        }
      }
    }

    load();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [id]);

  if (error) {
    return (
      <section className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
        <Link to="/orders" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-ink hover:text-moss">
          <ArrowLeft size={16} /> Meus pedidos
        </Link>
        <ErrorMessage message={error} />
      </section>
    );
  }

  if (!order) {
    return <div className="mx-auto max-w-4xl px-5 sm:px-8"><LoadingMessage label="Carregando pedido" /></div>;
  }

  const steps = buildSteps(order, payment);

  return (
    <section className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-12">
      <Link to="/orders" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-ink/65 transition-colors hover:text-ink">
        <ArrowLeft size={16} /> Meus pedidos
      </Link>

      {justCreated && order.status === 'PENDING' && (
        <p className="mb-6 rounded-[5px] bg-[#eef3d0] px-4 py-3 text-sm text-ink" role="status">
          Pedido enviado! Acompanhe abaixo a reserva do estoque e o pagamento.
        </p>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink/15 pb-5">
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-coral">Pedido #{shortId(order.id)}</p>
          <h1 className="font-display text-[34px] font-semibold text-ink">{formatPrice(order.totalAmount)}</h1>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <ol className="mt-8 grid gap-5 sm:grid-cols-4" aria-label="Andamento do pedido">
        {steps.map((step) => (
          <li key={step.label} className="flex gap-3 sm:flex-col">
            <span className={`grid size-7 shrink-0 place-items-center rounded-full ${stepStyle[step.state]}`}>{stepIcon[step.state]}</span>
            <div>
              <p className={`text-sm font-semibold ${step.state === 'todo' ? 'text-ink/45' : 'text-ink'}`}>{step.label}</p>
              <p className="mt-0.5 text-xs leading-5 text-ink/55">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>

      {order.status === 'CANCELLED' && order.statusReason && (
        <div className="mt-8"><ErrorMessage message={`Motivo do cancelamento: ${order.statusReason}`} /></div>
      )}

      <h2 className="mb-3 mt-10 font-display text-[22px] font-semibold text-ink">Itens</h2>
      <ul className="divide-y divide-ink/10 border-y border-ink/10">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-4 py-4 text-sm">
            <div className="min-w-0">
              <Link to={`/products/${item.productId}`} className="break-words font-semibold text-ink hover:text-moss">{item.productName}</Link>
              <p className="mt-0.5 tabular-nums text-ink/55">{item.quantity} × {formatPrice(item.unitPrice)}</p>
            </div>
            <p className="font-semibold tabular-nums text-ink">{formatPrice(item.subtotal)}</p>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-right text-xs text-ink/45">Atualizado em {formatDate(order.updatedAt)}</p>
    </section>
  );
}
