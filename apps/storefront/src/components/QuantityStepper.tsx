import { Minus, Plus } from 'lucide-react';

interface QuantityStepperProps {
  readonly value: number;
  readonly max?: number;
  readonly onChange: (value: number) => void;
  readonly label: string;
}

export default function QuantityStepper({ value, max, onChange, label }: QuantityStepperProps) {
  const canIncrease = max === undefined || value < max;

  return (
    <div className="inline-flex h-11 items-center rounded-full border border-ink/20" role="group" aria-label={label}>
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= 1}
        className="grid size-11 place-items-center rounded-full text-ink transition-colors hover:bg-mist disabled:opacity-30"
        aria-label="Diminuir quantidade"
      >
        <Minus size={15} />
      </button>
      <span className="w-8 text-center text-sm font-bold tabular-nums text-ink" aria-live="polite">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={!canIncrease}
        className="grid size-11 place-items-center rounded-full text-ink transition-colors hover:bg-mist disabled:opacity-30"
        aria-label="Aumentar quantidade"
      >
        <Plus size={15} />
      </button>
    </div>
  );
}
