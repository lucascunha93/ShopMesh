import { ArrowUpRight, Leaf, LogIn, LogOut, ShoppingBag } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

function navClassName({ isActive }: { isActive: boolean }) {
  return `text-sm font-semibold transition-colors ${isActive ? 'text-ink' : 'text-ink/55 hover:text-ink'}`;
}

export default function Header() {
  const { user, logout, isAuthenticated } = useAuth();
  const { itemCount } = useCart();

  return (
    <header className="border-b border-ink/10 bg-paper">
      <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link to="/" className="group flex items-center gap-2.5" aria-label="ShopMesh, página inicial">
          <span className="grid size-9 place-items-center rounded-full bg-ink text-leaf transition-transform group-hover:rotate-[-12deg]">
            <Leaf size={19} strokeWidth={2.2} />
          </span>
          <span className="hidden font-display text-[25px] font-semibold leading-none text-ink min-[420px]:inline">shopmesh</span>
        </Link>

        <nav className="flex items-center gap-3 sm:gap-7" aria-label="Navegação principal">
          <NavLink to="/" end className={navClassName}>
            Explorar
          </NavLink>
          {isAuthenticated && (
            <NavLink to="/orders" className={navClassName}>
              Pedidos
            </NavLink>
          )}
          <NavLink
            to="/cart"
            className="relative grid size-10 place-items-center rounded-full border border-ink/20 text-ink transition-colors hover:border-ink"
            aria-label={`Sacola com ${itemCount} ${itemCount === 1 ? 'item' : 'itens'}`}
          >
            <ShoppingBag size={17} />
            {itemCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-coral px-1 text-[11px] font-bold leading-5 text-white">
                {itemCount > 99 ? '99+' : itemCount}
              </span>
            )}
          </NavLink>
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-ink/65 md:inline">Olá, {user?.name.split(' ')[0]}</span>
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-2 rounded-full border border-ink/20 px-3.5 py-2 text-sm font-semibold text-ink transition-colors hover:border-ink hover:bg-ink hover:text-paper"
                aria-label="Sair da conta"
              >
                <LogOut size={15} />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          ) : (
            <Link to="/login" className="inline-flex items-center gap-2 rounded-full bg-leaf px-3 py-2.5 text-sm font-bold text-ink transition-transform hover:-translate-y-0.5 sm:px-4">
              <LogIn size={16} />
              <span>Entrar</span>
              <ArrowUpRight size={14} className="hidden sm:block" />
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
