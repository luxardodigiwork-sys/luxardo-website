/**
 * Client copy of evaluateCancellation (functions/src/core.ts). Used only to decide whether to SHOW a cancel button;
 * the server re-checks everything. A test keeps both implementations in agreement.
 */
export const CANCELLATION_WINDOW_HOURS = 24;
export type CancellationMode = 'cancel_unpaid' | 'request';
export interface CancellationVerdict { allowed: boolean; mode?: CancellationMode; reason?: string }

export function evaluateCancellation(
  order: { status?: string; paymentStatus?: string; createdAt?: string; paidAt?: string; trackingId?: string | null; cancellationRequest?: unknown },
  now: Date = new Date(),
): CancellationVerdict {
  if (order.cancellationRequest) return { allowed: false, reason: 'A cancellation has already been requested for this order.' };
  if (order.status === 'cancelled') return { allowed: false, reason: 'This order is already cancelled.' };
  if (order.trackingId) return { allowed: false, reason: 'This order has already been dispatched.' };
  const paid = order.paymentStatus === 'paid' || order.paymentStatus === 'confirmed';
  if (!paid && order.paymentStatus === 'pending' && order.status === 'pending') return { allowed: true, mode: 'cancel_unpaid' };
  if (!paid || order.status !== 'processing') {
    return { allowed: false, reason: 'This order can no longer be cancelled online because it is already being prepared or shipped.' };
  }
  const placed = new Date(order.paidAt || order.createdAt || '');
  if (Number.isNaN(placed.getTime())) return { allowed: false, reason: 'Order time is unavailable.' };
  if (now.getTime() - placed.getTime() > CANCELLATION_WINDOW_HOURS * 3_600_000) {
    return { allowed: false, reason: `Cancellation requests are accepted within ${CANCELLATION_WINDOW_HOURS} hours of placing an order.` };
  }
  return { allowed: true, mode: 'request' };
}
