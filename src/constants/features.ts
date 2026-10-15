/**
 * Customer-facing features that are switched off because the site cannot yet fulfil what they promise.
 * Re-enable only after the backing service exists AND has been tested end to end.
 */

/** "Notify me on low stock": subscriptions are stored, but nothing sends the alert yet. */
export const LOW_STOCK_ALERTS_ENABLED = false;


/**
 * Prime membership is NOT available until after launch: no marketing, pricing, terms, member-only pages, or
 * checkout are shown or reachable. All of that code is kept; flip this only when a server-verified Prime
 * payment flow exists and has been tested (see functions/ - there is intentionally no Prime function yet).
 */
export const PRIME_AVAILABLE = false;

/**
 * The /api/* Express endpoints (staff accounts, admin chatbot, email change, DTDC shipments) are NOT deployed
 * with the Firebase Hosting + Functions stack, so anything calling them would fail in production. Those UI
 * entry points are hidden/disabled while this is false. Manual tracking entry stays available.
 */
export const EXPRESS_BACKEND_AVAILABLE = false;

/**
 * Online ordering. OFF by default and switched on per build with VITE_CHECKOUT_ENABLED=true, ONLY after the secure
 * checkout functions (createCheckoutOrderFn, verifyPaymentFn, razorpayWebhook) and Razorpay keys are deployed and a
 * test payment has passed. While off, the cart shows "ordering opens soon" and /checkout redirects to /cart.
 */
export const CHECKOUT_ENABLED: boolean = (() => {
  try { return String(((import.meta as any).env || {}).VITE_CHECKOUT_ENABLED || '').trim() === 'true'; } catch { return false; }
})();
