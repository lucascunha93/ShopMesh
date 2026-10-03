import { ArrowUpRight, PackageOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Product } from '../types/Product';

const visualStyles = [
  'from-[#dce8c7] to-[#b3c99f]',
  'from-[#f4d8cb] to-[#dfa28d]',
  'from-[#d5e8e5] to-[#a4c8bf]',
  'from-[#e8e2c5] to-[#c7bd8f]',
];

function getVisualStyle(category: string) {
  const total = [...category].reduce((value, character) => value + (character.codePointAt(0) ?? 0), 0);
  return visualStyles[total % visualStyles.length];
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);
}

interface ProductCardProps {
  readonly product: Product;
  readonly index: number;
}

export default function ProductCard({ product, index }: ProductCardProps) {
  return (
    <Link
      to={`/products/${product._id}`}
      className="product-card group block overflow-hidden rounded-[5px] border border-ink/10 bg-white transition duration-300 hover:-translate-y-1 hover:border-ink/25 hover:shadow-[0_18px_45px_-30px_rgba(23,61,53,0.5)]"
      style={{ animationDelay: `${index * 55}ms` }}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-mist">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" loading="lazy" />
        ) : (
          <div className={`relative grid h-full place-items-center overflow-hidden bg-gradient-to-br ${getVisualStyle(product.category)}`}>
            <span className="absolute left-4 top-4 rounded-full border border-ink/20 bg-white/55 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-ink">
              {product.category || 'geral'}
            </span>
            <span className="product-orbit absolute h-[138px] w-[138px] rounded-full border border-ink/20" />
            <span className="product-orbit product-orbit-delayed absolute h-[190px] w-[190px] rounded-full border border-ink/15" />
            <span className="relative grid size-[86px] place-items-center rounded-[26px] bg-white/55 text-ink shadow-[0_16px_40px_-20px_rgba(23,61,53,0.42)] backdrop-blur-sm transition-transform duration-500 group-hover:rotate-[-7deg] group-hover:scale-105">
              <PackageOpen size={34} strokeWidth={1.25} />
            </span>
          </div>
        )}
        <span className="absolute bottom-3 right-3 grid size-9 translate-y-2 place-items-center rounded-full bg-paper text-ink opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
          <ArrowUpRight size={17} />
        </span>
      </div>
      <div className="flex min-h-[116px] flex-col justify-between px-4 pb-4 pt-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="line-clamp-2 min-w-0 break-words text-[15px] font-semibold leading-snug text-ink">{product.name}</h2>
          <span className="shrink-0 text-sm font-bold text-ink">{formatPrice(product.price)}</span>
        </div>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink/45">{product.category || 'geral'}</p>
      </div>
    </Link>
  );
}
