/**
 * Checkout is for phone-OTP-authenticated customers only: no guests, no anonymous sessions.
 * (The payment backend enforces the same rule server-side; this only drives the UI.)
 */
export type CheckoutGate = 'loading' | 'login' | 'ok';

export interface GateUser {
  isAnonymous: boolean;
  phoneNumber: string | null;
}

export function getCheckoutGate(input: { isAuthReady: boolean; firebaseUser: GateUser | null }): CheckoutGate {
  if (!input.isAuthReady) return 'loading';
  const u = input.firebaseUser;
  if (!u || u.isAnonymous || !u.phoneNumber) return 'login';
  return 'ok';
}

/** True when a callable failed because the session expired / is not phone-authenticated. */
export function isAuthFailure(err: unknown): boolean {
  const code = (err as any)?.code;
  return code === 'functions/unauthenticated' || code === 'unauthenticated' || code === 'auth/user-token-expired';
}

/** Customer-safe message for payment errors (never leaks internals). */
export function paymentErrorMessage(err: unknown): string {
  const code: string = (err as any)?.code ?? '';
  const message: string = (err as any)?.message ?? '';
  if (code.endsWith('failed-precondition') || code.endsWith('invalid-argument')) return message || 'Please review your cart and details.';
  if (code.endsWith('permission-denied')) return 'We could not verify your payment. If money was deducted it will be reconciled automatically; please contact support.';
  if (code.endsWith('unavailable') || code.endsWith('deadline-exceeded')) return 'Network problem. Please try again.';
  return 'Something went wrong while starting your payment. Please try again.';
}
