import { FREE_SHIPPING_THRESHOLD_RUPEES, SHIPPING_FEE_BELOW_THRESHOLD_RUPEES } from '../constants/pricing';

export interface ShippingQuote {
  subtotal: number;
  /** Shipping charge in rupees, or null when the order is below the threshold and no fee is configured. */
  shipping: number | null;
  free: boolean;
  /** Rupees still needed to reach free shipping (0 when already free). */
  amountToFreeShipping: number;
  /** False only if the order cannot be placed online (below the threshold and no fee configured). */
  canCheckout: boolean;
  total: number | null;
}

const toPaise = (rupees: number) => Math.round((Number.isFinite(rupees) ? rupees : 0) * 100);

/** Mirrors computeShippingPaise in functions/src/core.ts. Display only: the server always recomputes. */
export function getShippingQuote(
  subtotalRupees: number,
  thresholdRupees: number = FREE_SHIPPING_THRESHOLD_RUPEES,
  feeRupees: number | null = SHIPPING_FEE_BELOW_THRESHOLD_RUPEES,
): ShippingQuote {
  const subtotalPaise = toPaise(subtotalRupees);
  const thresholdPaise = toPaise(thresholdRupees);
  const subtotal = subtotalPaise / 100;
  if (subtotalPaise >= thresholdPaise) {
    return { subtotal, shipping: 0, free: true, amountToFreeShipping: 0, canCheckout: true, total: subtotal };
  }
  const amountToFreeShipping = (thresholdPaise - subtotalPaise) / 100;
  if (feeRupees === null) {
    return { subtotal, shipping: null, free: false, amountToFreeShipping, canCheckout: false, total: null };
  }
  const feePaise = toPaise(feeRupees);
  return { subtotal, shipping: feePaise / 100, free: false, amountToFreeShipping, canCheckout: true, total: (subtotalPaise + feePaise) / 100 };
}
