import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { CartProvider, mergeCarts, useCart, type CartItem } from './CartContext';
import type { Product } from '../types/Product';

const auth = vi.hoisted(() => ({ token: null as string | null }));
const cartApi = vi.hoisted(() => ({ fetchCart: vi.fn(), saveCart: vi.fn() }));

vi.mock('./AuthContext', () => ({ useAuth: () => ({ token: auth.token }) }));
vi.mock('../services/cart', () => cartApi);

const wrapper = ({ children }: Readonly<{ children: ReactNode }>) => <CartProvider>{children}</CartProvider>;

function product(overrides: Partial<Product> = {}): Product {
  return {
    _id: 'p1',
    name: 'Teclado',
    description: '',
    price: 100,
    category: 'perifericos',
    stock: 10,
    ...overrides,
  } as Product;
}

function cartItem(productId: string, quantity: number): CartItem {
  return { productId, name: productId, price: 10, category: 'c', quantity };
}

describe('CartContext', () => {
  beforeEach(() => {
    auth.token = null;
    cartApi.fetchCart.mockReset().mockResolvedValue([]);
    cartApi.saveCart.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('soma quantidades do mesmo produto e calcula totais', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(product(), 1);
      result.current.addItem(product(), 2);
      result.current.addItem(product({ _id: 'p2', name: 'Mouse', price: 50 }), 1);
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.itemCount).toBe(4);
    expect(result.current.total).toBe(350);
  });

  it('nunca deixa a quantidade abaixo de 1 e permite remover/limpar', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => result.current.addItem(product(), 3));
    act(() => result.current.updateQuantity('p1', 0));
    expect(result.current.items[0].quantity).toBe(1);

    act(() => result.current.removeItem('p1'));
    expect(result.current.items).toHaveLength(0);

    act(() => result.current.addItem(product(), 1));
    act(() => result.current.clear());
    expect(result.current.itemCount).toBe(0);
  });

  it('persiste a sacola no localStorage e ignora conteúdo corrompido', () => {
    const first = renderHook(() => useCart(), { wrapper });
    act(() => first.result.current.addItem(product(), 2));
    expect(JSON.parse(localStorage.getItem('shopmesh.cart') ?? '[]')).toHaveLength(1);
    first.unmount();

    const restored = renderHook(() => useCart(), { wrapper });
    expect(restored.result.current.itemCount).toBe(2);
    restored.unmount();

    localStorage.setItem('shopmesh.cart', '{corrompido');
    const broken = renderHook(() => useCart(), { wrapper });
    expect(broken.result.current.items).toEqual([]);
  });

  it('sem login não fala com o servidor', async () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(product(), 1));

    await new Promise((resolve) => { setTimeout(resolve, 700); });
    expect(cartApi.fetchCart).not.toHaveBeenCalled();
    expect(cartApi.saveCart).not.toHaveBeenCalled();
  });

  it('autenticado: traz o carrinho do servidor, mescla com o local e salva as mudanças', async () => {
    auth.token = 'token';
    cartApi.fetchCart.mockResolvedValue([cartItem('servidor', 2), cartItem('p1', 1)]);
    localStorage.setItem('shopmesh.cart', JSON.stringify([cartItem('p1', 5)]));

    const { result } = renderHook(() => useCart(), { wrapper });

    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.items.find((item) => item.productId === 'p1')?.quantity).toBe(5);

    await waitFor(() => expect(cartApi.saveCart).toHaveBeenCalled(), { timeout: 2000 });
    expect(cartApi.saveCart.mock.calls.at(-1)?.[0]).toHaveLength(2);
  });

  it('ao sair, limpa o carrinho local', async () => {
    auth.token = 'token';
    cartApi.fetchCart.mockResolvedValue([cartItem('p1', 1)]);
    const { result, rerender } = renderHook(() => useCart(), { wrapper });
    await waitFor(() => expect(result.current.itemCount).toBe(1));

    auth.token = null;
    rerender();

    await waitFor(() => expect(result.current.items).toEqual([]));
  });
});

describe('mergeCarts', () => {
  it('une os itens e deixa a quantidade local prevalecer', () => {
    const merged = mergeCarts([cartItem('a', 1), cartItem('b', 2)], [cartItem('b', 7), cartItem('c', 1)]);
    expect(merged.map((item) => [item.productId, item.quantity])).toEqual([['a', 1], ['b', 7], ['c', 1]]);
  });
});
