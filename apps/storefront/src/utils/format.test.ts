import { describe, expect, it } from 'vitest';
import { availableStock, formatPrice, shortId } from './format';

describe('format', () => {
  it('formata preço em reais', () => {
    expect(formatPrice(1234.5).replace(/\s/g, ' ')).toBe('R$ 1.234,50');
  });

  it('abrevia ids para 8 caracteres', () => {
    expect(shortId('6f1c3b1e-8a43-4e57-9d0a-1b2c3d4e5f60')).toBe('6f1c3b1e');
  });

  it('calcula o estoque disponível', () => {
    expect(availableStock({ stock: 10, reserved: 4 })).toBe(6);
    expect(availableStock({ stock: 2, reserved: 5 })).toBe(0);
    expect(availableStock({ stock: 10, availableStock: 3 })).toBe(3);
  });
});
