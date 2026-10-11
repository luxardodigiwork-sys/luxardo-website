import type { Order } from '../types';

export interface TrackingEvent {
  date: string;
  time: string;
  status: string;
  description?: string;
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
const label = (s: string) => s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

/**
 * Builds the tracking history ONLY from timestamps that exist on the order record:
 * createdAt, paidAt, the dispatch team's statusHistory entries and dispatchDate.
 * Nothing is estimated or invented: no locations, no sorting-centre hops, no delivery date.
 */
export function buildTrackingEvents(order: Partial<Order> & Record<string, any>): TrackingEvent[] {
  const events: { at: string; status: string; description?: string }[] = [];
  if (order.createdAt) events.push({ at: order.createdAt, status: 'Order received' });
  if (order.paymentStatus === 'paid' && order.paidAt) events.push({ at: order.paidAt, status: 'Payment received' });
  for (const h of order.statusHistory || []) {
    if (h?.timestamp) events.push({ at: h.timestamp, status: label(h.status), description: h.note });
  }
  if (order.status === 'cancelled' && order.cancelledAt) events.push({ at: order.cancelledAt, status: 'Order cancelled' });
  return events
    .filter((e) => !Number.isNaN(new Date(e.at).getTime()))
    .sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime())
    .map((e) => ({ date: fmtDate(e.at), time: fmtTime(e.at), status: e.status, description: e.description }));
}
