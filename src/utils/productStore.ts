import {
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Product } from '../types';
import { buildProductUpdate } from './productWrite';

/**
 * Firestore-backed product catalogue.
 *
 *  - Source of truth: the `products` collection (public read, admin-only write).
 *  - There is NO sample/placeholder fallback. Until the first snapshot the list is empty and
 *    `isLoaded()` is false; if Firestore has no products the list is empty and the storefront
 *    shows a "coming soon" state; if the listener fails `getError()` is set.
 *  - `getAll()` is synchronous so legacy callers keep working; React code should
 *    use `useProducts()` (ProductsContext) to re-render on changes.
 */

let cache: Product[] = [];
let loaded = false;
let started = false;
let lastError: Error | null = null;
const listeners = new Set<() => void>();

let resolveReady: () => void;
/** Resolves after the first Firestore snapshot, an error, or a 4s timeout. */
export const ready: Promise<void> = new Promise((res) => { resolveReady = res; });

const notify = () => listeners.forEach((l) => l());

/** Firestore rejects `undefined`; strip it while keeping every other field intact. */
const clean = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

export function start() {
  if (started) return;
  started = true;
  setTimeout(() => resolveReady(), 4000);
  onSnapshot(
    collection(db, 'products'),
    (snap) => {
      lastError = null;
      cache = snap.docs.map((d) => ({ ...(d.data() as Product), id: d.id }));
      loaded = true;
      notify();
      resolveReady();
    },
    (err) => {
      console.error('Product catalogue listener error:', err);
      lastError = err;
      loaded = true;
      notify();
      resolveReady();
    },
  );
}

async function writeMany(products: Product[]): Promise<void> {
  for (let i = 0; i < products.length; i += 400) {
    const batch = writeBatch(db);
    // merge + no stock: these bulk writes (e.g. image sync) must never overwrite live stock
    products.slice(i, i + 400).forEach((p) => batch.set(doc(db, 'products', p.id), clean(buildProductUpdate(p, undefined).data), { merge: true }));
    await batch.commit();
  }
}

export const productStore = {
  getAll: (): Product[] => cache,
  isLoaded: (): boolean => loaded,
  getError: (): Error | null => lastError,
  subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },

  /** Create a NEW product (admin only; enforced by security rules). Includes the starting stock. */
  async create(product: Product): Promise<void> {
    await setDoc(doc(db, 'products', product.id), clean(product));
  },

  /**
   * Update an existing product WITHOUT overwriting live stock. `loadedStock` is the stock the admin form started
   * from; only a real change to it is applied, as an increment, so concurrent reservations/sales are preserved.
   */
  async update(product: Product, loadedStock: number | undefined): Promise<void> {
    const { data, stockDelta } = buildProductUpdate(product, loadedStock);
    const payload: Record<string, unknown> = clean(data);
    if (stockDelta !== 0) payload.stock = increment(stockDelta);
    await setDoc(doc(db, 'products', product.id), payload, { merge: true });
  },

  /** Write several products in batches of <= 400. Only the given products are touched. */
  async saveMany(products: Product[]): Promise<void> {
    await writeMany(products);
  },

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(db, 'products', id));
  },
};
