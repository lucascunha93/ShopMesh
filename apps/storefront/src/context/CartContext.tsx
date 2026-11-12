import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import * as cartService from '../services/cart';
import type { Product } from '../types/Product';

const STORAGE_KEY = 'shopmesh.cart';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  category: string;
  imageUrl?: string;
  quantity: number;
}

interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  total: number;
  addItem: (product: Product, quantity: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

function readStoredCart(): CartItem[] {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed as CartItem[] : [];
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

// Une o carrinho do servidor com o local; em conflito, vale a quantidade local (ação mais recente).
export function mergeCarts(server: CartItem[], local: CartItem[]): CartItem[] {
  const merged = new Map(server.map((item) => [item.productId, item]));
  for (const item of local) {
    merged.set(item.productId, item);
  }
  return [...merged.values()];
}

const SYNC_DELAY_MS = 500;

export function CartProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { token } = useAuth();
  const [items, setItems] = useState<CartItem[]>(readStoredCart);
  const hydratedToken = useRef<string | null>(null);
  const previousToken = useRef<string | null>(token);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  // Ao autenticar, traz o carrinho salvo no servidor; ao sair, limpa o carrinho local
  // (o do servidor permanece e volta no próximo login).
  useEffect(() => {
    const hadToken = previousToken.current !== null;
    previousToken.current = token;

    if (!token) {
      hydratedToken.current = null;
      if (hadToken) {
        setItems([]);
      }
      return undefined;
    }

    let cancelled = false;
    cartService.fetchCart()
      .then((serverItems) => {
        if (cancelled) {
          return;
        }
        setItems((local) => mergeCarts(serverItems, local));
        hydratedToken.current = token;
      })
      .catch(() => console.error('[cart] Não foi possível carregar o carrinho do servidor'));

    return () => {
      cancelled = true;
    };
  }, [token]);

  // Depois da hidratação, qualquer mudança é salva no servidor (com debounce).
  useEffect(() => {
    if (!token || hydratedToken.current !== token) {
      return undefined;
    }

    const timer = setTimeout(() => {
      cartService.saveCart(items)
        .catch(() => console.error('[cart] Não foi possível salvar o carrinho no servidor'));
    }, SYNC_DELAY_MS);

    return () => clearTimeout(timer);
  }, [items, token]);

  const addItem = useCallback((product: Product, quantity: number) => {
    setItems((current) => {
      const existing = current.find((item) => item.productId === product._id);
      if (existing) {
        return current.map((item) => (item.productId === product._id
          ? { ...item, quantity: item.quantity + quantity, price: product.price, name: product.name }
          : item));
      }
      return [...current, {
        productId: product._id,
        name: product.name,
        price: product.price,
        category: product.category,
        imageUrl: product.imageUrl,
        quantity,
      }];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setItems((current) => current.map((item) => (item.productId === productId
      ? { ...item, quantity: Math.max(1, quantity) }
      : item)));
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((current) => current.filter((item) => item.productId !== productId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(() => ({
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    addItem,
    updateQuantity,
    removeItem,
    clear,
  }), [items, addItem, updateQuantity, removeItem, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error('useCart deve ser usado dentro de CartProvider');
  }

  return context;
}

