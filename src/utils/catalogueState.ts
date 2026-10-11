import { Product } from '../types';

export type CatalogueState = 'loading' | 'error' | 'empty' | 'ready';

/** Pure helper so every storefront surface renders the same loading/error/empty logic. */
export function getCatalogueState(input: {
  isLoaded: boolean;
  error: Error | null;
  products: Product[];
}): CatalogueState {
  if (!input.isLoaded) return 'loading';
  if (input.error && input.products.length === 0) return 'error';
  if (input.products.length === 0) return 'empty';
  return 'ready';
}

/** Customer-facing products: hidden items and non-numeric/negative prices never reach the storefront. */
export function getStorefrontProducts(products: Product[]): Product[] {
  return products.filter(
    (p) => p.visibility !== 'hidden' && typeof p.price === 'number' && p.price >= 0,
  );
}

export function isPurchasable(p: Pick<Product, 'stock'>): boolean {
  return p.stock === undefined ? false : p.stock > 0;
}
