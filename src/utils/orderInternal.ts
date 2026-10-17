/**
 * Splitting of an order into the customer-readable `orders/{id}` document and the staff-only `orderInternal/{id}` document
 * (see firestore.rules). Pure helpers, no Firebase import, unit tested.
 */
export type HistoryEntry = { status: string; timestamp: string; note?: string };

/** Written by admin/dispatch into orderInternal (also the only keys firestore.rules lets them write there). */
export const STAFF_INTERNAL_FIELDS = ['verificationStatus', 'internalRemarks', 'assignedStaffId', 'assignedStaffName', 'internalLog'] as const;
/** Written only by the server (Admin SDK) into orderInternal; staff can read them there. */
export const SERVER_INTERNAL_FIELDS = ['needsRefund', 'lastPaymentError', 'lastFailedPaymentId', 'duplicatePaymentIds'] as const;
export const ALL_INTERNAL_FIELDS: readonly string[] = [...STAFF_INTERNAL_FIELDS, ...SERVER_INTERNAL_FIELDS];

/** Statuses that may appear in the customer-facing timeline (`orders.statusHistory`). Workflow states like "packing_ready" may not. */
export const CUSTOMER_HISTORY_STATUSES = ['pending', 'processing', 'packed', 'shipped', 'delivered', 'cancelled', 'returned', 'failed_delivery', 'on_hold'];

export const isCustomerSafeHistoryEntry = (h: unknown): h is HistoryEntry =>
  !!h && typeof (h as HistoryEntry).status === 'string' && CUSTOMER_HISTORY_STATUSES.includes((h as HistoryEntry).status) && typeof (h as HistoryEntry).timestamp === 'string';

/**
 * Splits a staff edit into what goes onto the customer-readable order and what goes into the staff-only document.
 * Timeline entries that are not customer-safe are moved to the internal log instead of being published to the customer.
 */
export function splitOrderPatch(patch: Record<string, unknown>): { publicPatch: Record<string, unknown>; internalPatch: Record<string, unknown> } {
  const publicPatch: Record<string, unknown> = {};
  const internalPatch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if ((STAFF_INTERNAL_FIELDS as readonly string[]).includes(k)) internalPatch[k] = v;
    else publicPatch[k] = v;
  }
  if (Array.isArray(publicPatch.statusHistory)) {
    const all = publicPatch.statusHistory as unknown[];
    const safe = all.filter(isCustomerSafeHistoryEntry);
    const unsafe = all.filter((h) => !isCustomerSafeHistoryEntry(h));
    publicPatch.statusHistory = safe;
    if (unsafe.length) {
      const base = Array.isArray(internalPatch.internalLog) ? (internalPatch.internalLog as unknown[]) : [];
      internalPatch.internalLog = [...base, ...unsafe];
    }
  }
  return { publicPatch, internalPatch };
}

/** Staff view: the order with its internal document laid over it (legacy private fields on the order document still show if present). */
export function mergeInternal<T extends Record<string, any>>(order: T, internal: Record<string, any> | undefined): T {
  return internal ? ({ ...order, ...internal } as T) : order;
}
