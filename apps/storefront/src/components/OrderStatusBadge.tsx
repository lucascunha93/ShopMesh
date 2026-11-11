import { CheckCircle2, Clock3, XCircle } from 'lucide-react';
import type { OrderStatus } from '../types/Order';

const styles: Record<OrderStatus, { label: string; className: string; Icon: typeof Clock3 }> = {
  PENDING: { label: 'Em processamento', className: 'bg-[#f3efd2] text-[#6b5d1d]', Icon: Clock3 },
  CONFIRMED: { label: 'Confirmado', className: 'bg-[#e1edd2] text-moss', Icon: CheckCircle2 },
  CANCELLED: { label: 'Cancelado', className: 'bg-[#f8e8e1] text-[#713d32]', Icon: XCircle },
};

export default function OrderStatusBadge({ status }: Readonly<{ status: OrderStatus }>) {
  const { label, className, Icon } = styles[status];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${className}`}>
      <Icon size={14} /> {label}
    </span>
  );
}
