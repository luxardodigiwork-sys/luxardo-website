import { useEffect, useSyncExternalStore } from 'react';
import { collection, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { Order } from '../types';

/**
 * Firestore `orders` is the ONLY order database. This store is the admin-side live view
 * (admins may list every order; customers can only read their own, see firestore.rules).
 * Writes are limited to fulfilment fields; payment/stock fields are server-owned, and
 * cancellation goes through the `cancelOrderFn` callable so stock is restored exactly once.
 */

let cache: Order[] = [];
let loaded = false;
let error: Error | null = null;
let started = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

const normalise = (id: string, d: Record<string, any>): Order =>
  ({
    ...d,
    id,
    userName: d.userName || d.customer?.fullName || d.shippingAddress?.fullName || 'Customer',
    userEmail: d.userEmail || d.shippingAddress?.email || '',
    items: (d.items || []).map((i: any) => ({ ...i, name: i.name || i.title || 'Product' })),
  }) as Order;

export function startAdminOrders() {
  if (started) return;
  started = true;
  onSnapshot(
    query(collection(db, 'orders'), orderBy('createdAt', 'desc')),
    (snap) => { cache = snap.docs.map((d) => normalise(d.id, d.data())); loaded = true; error = null; notify(); },
    (err) => { console.error('Orders listener error:', err); error = err; loaded = true; notify(); },
  );
}

/** Only these fields may be changed from the admin UI. Everything else (money, payment, stock) is server-owned. */
export const ADMIN_EDITABLE_ORDER_FIELDS = [
  'status', 'verificationStatus', 'trackingId', 'trackingUrl', 'courierName', 'courierService',
  'courierStatus', 'dispatchDate', 'dispatchNote', 'assignedStaffId', 'assignedStaffName',
  'internalRemarks', 'statusHistory',
] as const;

const clean = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export const orderStore = {
  getAll: (): Order[] => cache,
  isLoaded: () => loaded,
  getError: () => error,
  subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },

  /** Persists only the orders that changed vs. the live cache, and only admin-editable fields. */
  async saveOrders(next: Order[]): Promise<void> {
    const before = new Map(cache.map((o) => [o.id, o]));
    for (const order of next) {
      const prev = before.get(order.id);
      if (!prev) continue;
      const patch: Record<string, unknown> = {};
      for (const key of ADMIN_EDITABLE_ORDER_FIELDS) {
        if (JSON.stringify((order as any)[key]) !== JSON.stringify((prev as any)[key]) && (order as any)[key] !== undefined) {
          patch[key] = (order as any)[key];
        }
      }
      if (patch.status === 'cancelled') {
        delete patch.status;
        await httpsCallable(functions, 'cancelOrderFn')({ orderId: order.id }); // restores stock exactly once
      }
      if (Object.keys(patch).length) {
        await updateDoc(doc(db, 'orders', order.id), clean({ ...patch, updatedAt: new Date().toISOString() }));
      }
    }
  },
};

/** Live admin order list; starts the Firestore listener on first use. */
export function useAdminOrders() {
  useEffect(() => { startAdminOrders(); }, []);
  const orders = useSyncExternalStore(orderStore.subscribe, orderStore.getAll);
  const isLoaded = useSyncExternalStore(orderStore.subscribe, orderStore.isLoaded);
  const err = useSyncExternalStore(orderStore.subscribe, orderStore.getError);
  return { orders, isLoaded, error: err };
}

/** Fire-and-report wrapper for UI handlers that used to call a synchronous saveOrders(). */
export function persistOrders(next: Order[]): void {
  orderStore.saveOrders(next).catch((err) => {
    console.error('Failed to update order:', err);
    alert(err?.message || 'Failed to update the order. Check that you are signed in as an admin.');
  });
}
