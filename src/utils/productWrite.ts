import { Product } from '../types';

/**
 * Stock is changed by the payment backend (reservations, releases). An admin screen that rewrites the WHOLE product
 * with the stock number it loaded earlier would silently undo those changes and let the same piece be sold twice.
 * So an update never writes `stock` as an absolute number: it writes everything else and, when staff really changed
 * the stock field, applies only the DIFFERENCE (the store turns that into a Firestore increment).
 */
export interface ProductUpdateWrite {
  /** Every product field except `stock`. */
  data: Omit<Product, 'stock'>;
  /** Amount to add to the live stock (can be negative); 0 means "do not touch stock". */
  stockDelta: number;
}

export function buildProductUpdate(next: Product, loadedStock: number | undefined): ProductUpdateWrite {
  const { stock, ...data } = next;
  const wanted = Number(stock);
  const before = Number(loadedStock ?? 0);
  const delta = Number.isFinite(wanted) && Number.isFinite(before) ? Math.trunc(wanted) - Math.trunc(before) : 0;
  return { data: data as Omit<Product, 'stock'>, stockDelta: delta };
}
