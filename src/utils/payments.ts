import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

export interface CheckoutLine { productId: string; quantity: number; size: string }
export interface CheckoutAddress {
  fullName: string; email: string; phone: string;
  addressLine1: string; addressLine2: string; city: string; state: string; postalCode: string;
}
export interface CreatedCheckout {
  orderId: string; razorpayOrderId: string; amount: number; currency: string; keyId: string;
}
export interface RazorpaySuccess {
  razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string;
}

/** Client sends ONLY product ids, quantities, sizes and the address. Prices are computed server-side. */
export const createCheckoutOrder = (items: CheckoutLine[], address: CheckoutAddress, requestId?: string) =>
  httpsCallable<{ items: CheckoutLine[]; address: CheckoutAddress; requestId?: string }, CreatedCheckout>(functions, 'createCheckoutOrderFn')({ items, address, requestId })
    .then((r) => r.data);

export const verifyPayment = (orderId: string, res: RazorpaySuccess) =>
  httpsCallable<{ orderId: string } & RazorpaySuccess, { status: string }>(functions, 'verifyPaymentFn')({ orderId, ...res })
    .then((r) => r.data);

/** Cancel an unpaid order now, or file a cancellation request for a paid one (staff approve and refund; nothing is automatic). */
export const requestOrderCancellation = (orderId: string, reason?: string) =>
  httpsCallable<{ orderId: string; reason?: string }, { outcome: 'cancelled' | 'requested' }>(functions, 'requestCancellationFn')({ orderId, reason })
    .then((r) => r.data);

/** Ask to return a delivered order (within 7 days of delivery). Staff review it; no refund is automatic. */
export const requestOrderReturn = (orderId: string, reason?: string) =>
  httpsCallable<{ orderId: string; reason?: string }, { outcome: 'requested' }>(functions, 'requestReturnFn')({ orderId, reason })
    .then((r) => r.data);

let scriptPromise: Promise<void> | null = null;
/** Loads Razorpay Checkout (public script; only the public key id is ever used in the browser). */
export function loadRazorpay(): Promise<void> {
  if ((window as any).Razorpay) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = () => resolve();
      s.onerror = () => { scriptPromise = null; reject(new Error('Could not load the payment window.')); };
      document.body.appendChild(s);
    });
  }
  return scriptPromise;
}
