import { ArrowUpRight, Leaf } from 'lucide-react';
import { Link, Route, Routes } from 'react-router-dom';
import Header from './components/Header';
import LoginPage from './pages/LoginPage';
import ProductDetailPage from './pages/ProductDetailPage';
import ProductListPage from './pages/ProductListPage';

function NotFoundPage() {
  return (
    <section className="mx-auto flex min-h-[55vh] max-w-7xl flex-col items-start justify-center px-5 sm:px-8">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-coral">404 · página não encontrada</p>
      <h1 className="mt-3 font-display text-[42px] font-semibold text-ink">Esse caminho não está no mapa.</h1>
      <Link to="/" className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-bold text-paper transition-colors hover:bg-moss">
        Voltar ao catálogo <ArrowUpRight size={16} />
      </Link>
    </section>
  );
}

export default function App() {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<ProductListPage />} />
          <Route path="/products/:id" element={<ProductDetailPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <footer className="border-t border-ink/10 bg-paper">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-5 text-xs text-ink/50 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Link to="/" className="inline-flex items-center gap-2 font-semibold text-ink/70">
            <Leaf size={15} /> ShopMesh
          </Link>
          <span>Feito para o cotidiano. Descoberto aqui.</span>
        </div>
      </footer>
    </div>
  );
}
