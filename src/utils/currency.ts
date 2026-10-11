/**
 * INR-only money formatting.
 *
 * Every price in the store is shown, charged and recorded in Indian rupees. There is intentionally NO
 * currency conversion, exchange-rate table, or per-visitor currency preference. Underlying product
 * prices are stored in INR and are never altered by display code.
 *
 * No tax wording ("MRP", "incl. tax") is attached to amounts here: whether listed prices include GST
 * is not yet confirmed, so tax labelling is controlled in one place (src/constants/pricing.ts).
 */
const make = (digits: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: digits, maximumFractionDigits: digits });
const WHOLE = make(0);
const WITH_PAISE = make(2);

/** Whole rupees show no decimals (₹25,000); amounts with paise always show two (₹2,500.50). */
export const formatINR = (amount: number): string => {
  const n = Number.isFinite(amount) ? amount : 0;
  return Number.isInteger(n) ? WHOLE.format(n) : WITH_PAISE.format(n);
};

/** Kept as the storefront-wide formatter name; identical to formatINR. */
export const formatCurrency = formatINR;
