import { ArrowUpRight, Leaf, LogIn, LogOut } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Header() {
  const { user, logout, isAuthenticated } = useAuth();

  return (
    <header className="border-b border-ink/10 bg-paper">
      <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link to="/" className="group flex items-center gap-2.5" aria-label="ShopMesh, página inicial">
          <span className="grid size-9 place-items-center rounded-full bg-ink text-leaf transition-transform group-hover:rotate-[-12deg]">
            <Leaf size={19} strokeWidth={2.2} />
          </span>
          <span className="font-display text-[25px] font-semibold leading-none text-ink">shopmesh</span>
        </Link>

        <nav className="flex items-center gap-3 sm:gap-8" aria-label="Navegação principal">
          <NavLink to="/" className={({ isActive }) => `text-sm font-semibold transition-colors ${isActive ? 'text-ink' : 'text-ink/55 hover:text-ink'}`}>
            Explorar
          </NavLink>
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-ink/65 sm:inline">Olá, {user?.name.split(' ')[0]}</span>
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-2 rounded-full border border-ink/20 px-3.5 py-2 text-sm font-semibold text-ink transition-colors hover:border-ink hover:bg-ink hover:text-paper"
                aria-label="Sair da conta"
              >
                <LogOut size={15} />
                <span>Sair</span>
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
