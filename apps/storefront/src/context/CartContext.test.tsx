import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { CartProvider, useCart } from './CartContext';
import type { Product } from '../types/Product';

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

describe('CartContext', () => {
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
});
