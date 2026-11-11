import type { ReactNode } from 'react';
import { Leaf } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AuthShellProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly subtitle: string;
  readonly children: ReactNode;
  readonly footer: ReactNode;
}

export default function AuthShell({ eyebrow, title, subtitle, children, footer }: AuthShellProps) {
  return (
    <section className="mx-auto grid min-h-[calc(100vh-156px)] max-w-7xl px-5 py-8 sm:px-8 lg:grid-cols-[1fr_0.9fr] lg:py-12">
      <div className="relative hidden min-h-[540px] overflow-hidden rounded-l-[5px] bg-ink p-10 text-paper lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="login-graphic pointer-events-none absolute inset-0 opacity-70" />
        <Link to="/" className="relative z-10 inline-flex w-fit items-center gap-2.5 text-paper">
          <span className="grid size-10 place-items-center rounded-full bg-leaf text-ink"><Leaf size={20} /></span>
          <span className="font-display text-[25px] font-semibold">shopmesh</span>
        </Link>
        <div className="relative z-10 max-w-md pb-5">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.14em] text-leaf">Sua próxima descoberta começa aqui</p>
          <h1 className="font-display text-[47px] font-semibold leading-[1.08]">Um lugar para encontrar o que combina com você.</h1>
          <p className="mt-5 max-w-sm text-[15px] leading-7 text-paper/70">Entre para continuar explorando a seleção ShopMesh.</p>
        </div>
        <p className="relative z-10 text-xs text-paper/50">ShopMesh · catálogo para o cotidiano</p>
      </div>

      <div className="flex min-h-[540px] flex-col justify-center rounded-[5px] border border-ink/10 bg-white px-6 py-10 sm:px-12 lg:rounded-l-none lg:px-14">
        <Link to="/" className="mb-10 inline-flex items-center gap-2 text-sm font-semibold text-ink/60 transition-colors hover:text-ink lg:hidden">
          <Leaf size={17} /> shopmesh
        </Link>
        <div className="mb-8">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-coral">{eyebrow}</p>
          <h2 className="font-display text-[36px] font-semibold leading-tight text-ink">{title}</h2>
          <p className="mt-3 text-sm leading-6 text-ink/60">{subtitle}</p>
        </div>
        {children}
        <div className="mt-6 text-center text-xs leading-5 text-ink/45">{footer}</div>
      </div>
    </section>
  );
}

interface AuthFieldProps {
  readonly label: string;
  readonly icon: ReactNode;
  readonly children: ReactNode;
}

export function AuthField({ label, icon, children }: AuthFieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-ink">{label}</span>
      <span className="flex min-h-12 items-center gap-3 rounded-[4px] border border-ink/20 px-4 transition-colors focus-within:border-ink">
        <span className="shrink-0 text-ink/40">{icon}</span>
        {children}
      </span>
    </label>
  );
}

export const authInputClassName = 'min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink/35';
export const authButtonClassName = 'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-6 text-sm font-bold text-paper transition-colors hover:bg-moss disabled:cursor-wait disabled:opacity-60';
