const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export function formatPrice(value: number) {
  return currencyFormatter.format(value);
}

export function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

export function shortId(id: string) {
  return id.slice(0, 8);
}

export function availableStock(product: { stock: number; reserved?: number; availableStock?: number }) {
  return product.availableStock ?? Math.max(product.stock - (product.reserved ?? 0), 0);
}
