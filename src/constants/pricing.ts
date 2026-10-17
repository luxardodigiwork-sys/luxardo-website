/**
 * Customer-facing pricing rules and copy, kept in ONE place.
 *
 * Shipping (confirmed business rule): FREE for orders of Rs 7,499 or more; Rs 199 for orders below that.
 * The payment backend enforces the same rule (functions/src/core.ts) and a test keeps the two copies identical.
 *
 * TAX_NOTE is intentionally empty: whether listed prices are GST-inclusive is NOT confirmed. Do not add a tax claim
 * here until the owner confirms the treatment. Orders store `taxTreatment: 'unconfirmed'` until then.
 */
export const FREE_SHIPPING_THRESHOLD_RUPEES = 7499;
export const SHIPPING_FEE_BELOW_THRESHOLD_RUPEES: number | null = 199;
export const SHIPPING_NOTE = 'Free shipping on orders of ₹7,499 or more (₹199 below that)';
export const TAX_NOTE = '';
