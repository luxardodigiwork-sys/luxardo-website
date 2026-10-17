/**
 * Client copy of evaluateReturn (functions/src/core.ts). Used only to decide whether to SHOW the return button;
 * the server re-checks everything. A test keeps both implementations in agreement.
 */
export const RETURN_WINDOW_DAYS = 7;
export interface ReturnVerdict { allowed: boolean; reason?: string; deliveredAt?: string }
type History = Array<{ status?: string; timestamp?: string }>;

export function deliveredAtOf(order: { statusHistory?: History }): string | undefined {
  const hist = Array.isArray(order.statusHistory) ? order.statusHistory : [];
  for (let i = hist.length - 1; i >= 0; i--) {
    if (hist[i]?.status === 'delivered' && typeof hist[i]?.timestamp === 'string') return hist[i].timestamp;
  }
  return undefined;
}

export function evaluateReturn(
  order: { status?: string; paymentStatus?: string; statusHistory?: History; returnRequest?: unknown },
  now: Date = new Date(),
): ReturnVerdict {
  if (order.returnRequest) return { allowed: false, reason: 'A return has already been requested for this order.' };
  const paid = order.paymentStatus === 'paid' || order.paymentStatus === 'confirmed';
  if (!paid || order.status !== 'delivered') return { allowed: false, reason: 'Returns can be requested only after your order has been delivered.' };
  const at = deliveredAtOf(order);
  const d = at ? new Date(at) : new Date(NaN);
  if (Number.isNaN(d.getTime())) return { allowed: false, reason: 'Delivery date is unavailable. Please contact support.' };
  if (now.getTime() - d.getTime() > RETURN_WINDOW_DAYS * 86_400_000) {
    return { allowed: false, reason: `Returns are accepted within ${RETURN_WINDOW_DAYS} days of delivery.` };
  }
  return { allowed: true, deliveredAt: d.toISOString() };
}
