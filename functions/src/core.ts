/**
 * Pure payment/order logic (no Firebase, no network) so it can be unit-tested.
 * All money is computed in integer paise on the server from authoritative product data.
 */
import * as crypto from "crypto";

export const CURRENCY = "INR";
export const MAX_LINES = 20;
export const MAX_QTY_PER_LINE = 10;
export const MAX_PENDING_ORDERS_PER_USER = 5;

/** Free shipping at or above this order subtotal (Rs 7,499). Keep in sync with src/constants/pricing.ts (a test enforces it). */
export const FREE_SHIPPING_THRESHOLD_PAISE = 749900;
/**
 * Shipping fee for orders BELOW the threshold: Rs 199 (confirmed by the business). Keep in sync with
 * src/constants/pricing.ts (a test enforces it). `null` would mean "no fee configured" and refuses such orders.
 */
export const SHIPPING_FEE_BELOW_THRESHOLD_PAISE: number | null = 19900;

export interface ShippingConfig { thresholdPaise: number; feeBelowThresholdPaise: number | null }
export const DEFAULT_SHIPPING: ShippingConfig = {
  thresholdPaise: FREE_SHIPPING_THRESHOLD_PAISE,
  feeBelowThresholdPaise: SHIPPING_FEE_BELOW_THRESHOLD_PAISE,
};

/** Shipping charge in paise for an order subtotal. Throws if the order is below the threshold and no fee is configured. */
export function computeShippingPaise(subtotalPaise: number, cfg: ShippingConfig = DEFAULT_SHIPPING): number {
  if (subtotalPaise >= cfg.thresholdPaise) return 0;
  if (cfg.feeBelowThresholdPaise === null) {
    throw new OrderError(
      "failed-precondition",
      `Online orders below ₹${(cfg.thresholdPaise / 100).toLocaleString("en-IN")} cannot be placed yet. Free shipping applies to orders of ₹${(cfg.thresholdPaise / 100).toLocaleString("en-IN")} or more.`,
    );
  }
  return cfg.feeBelowThresholdPaise;
}

export const CANCELLATION_WINDOW_HOURS = 24;
export type CancellationMode = "cancel_unpaid" | "request";
export interface CancellationVerdict { allowed: boolean; mode?: CancellationMode; reason?: string }

/**
 * Who may cancel what. A customer may act within 24h of placing the order, and only while the order is safe to stop:
 *  - unpaid + pending            -> cancelled immediately (stock released)
 *  - paid + still "processing"   -> a cancellation REQUEST for staff to approve and refund (never automatic)
 * Anything packed/shipped/delivered/on hold/already cancelled/already requested is refused.
 */
export function evaluateCancellation(
  order: { status?: string; paymentStatus?: string; createdAt?: string; paidAt?: string; trackingId?: string | null; cancellationRequest?: unknown },
  now: Date = new Date(),
): CancellationVerdict {
  if (order.cancellationRequest) return { allowed: false, reason: "A cancellation has already been requested for this order." };
  if (order.status === "cancelled") return { allowed: false, reason: "This order is already cancelled." };
  if (order.trackingId) return { allowed: false, reason: "This order has already been dispatched." };
  const paid = order.paymentStatus === "paid" || order.paymentStatus === "confirmed";
  if (!paid && order.paymentStatus === "pending" && order.status === "pending") return { allowed: true, mode: "cancel_unpaid" };
  if (!paid || order.status !== "processing") {
    return { allowed: false, reason: "This order can no longer be cancelled online because it is already being prepared or shipped." };
  }
  const placed = new Date(order.paidAt || order.createdAt || "");
  if (Number.isNaN(placed.getTime())) return { allowed: false, reason: "Order time is unavailable." };
  if (now.getTime() - placed.getTime() > CANCELLATION_WINDOW_HOURS * 3_600_000) {
    return { allowed: false, reason: `Cancellation requests are accepted within ${CANCELLATION_WINDOW_HOURS} hours of placing an order.` };
  }
  return { allowed: true, mode: "request" };
}

export const RETURN_WINDOW_DAYS = 7;
export interface ReturnVerdict { allowed: boolean; reason?: string; deliveredAt?: string }

/** Time the order was marked delivered by staff (latest "delivered" entry in the status history). */
export function deliveredAtOf(order: { statusHistory?: Array<{ status?: string; timestamp?: string }> }): string | undefined {
  const hist = Array.isArray(order.statusHistory) ? order.statusHistory : [];
  for (let i = hist.length - 1; i >= 0; i--) {
    if (hist[i]?.status === "delivered" && typeof hist[i]?.timestamp === "string") return hist[i].timestamp;
  }
  return undefined;
}

/** A customer may ask for a return within 7 days of DELIVERY of a paid order. Refunds are never automatic. */
export function evaluateReturn(
  order: { status?: string; paymentStatus?: string; statusHistory?: Array<{ status?: string; timestamp?: string }>; returnRequest?: unknown },
  now: Date = new Date(),
): ReturnVerdict {
  if (order.returnRequest) return { allowed: false, reason: "A return has already been requested for this order." };
  const paid = order.paymentStatus === "paid" || order.paymentStatus === "confirmed";
  if (!paid || order.status !== "delivered") return { allowed: false, reason: "Returns can be requested only after your order has been delivered." };
  const at = deliveredAtOf(order);
  const d = at ? new Date(at) : new Date(NaN);
  if (Number.isNaN(d.getTime())) return { allowed: false, reason: "Delivery date is unavailable. Please contact support." };
  if (now.getTime() - d.getTime() > RETURN_WINDOW_DAYS * 86_400_000) {
    return { allowed: false, reason: `Returns are accepted within ${RETURN_WINDOW_DAYS} days of delivery.` };
  }
  return { allowed: true, deliveredAt: d.toISOString() };
}
export const PAYMENT_WINDOW_MINUTES = 30;
/** Sizes offered by the storefront (ProductPage). Size only selects fabric/panel quantity. */
export const ALLOWED_SIZES = ["38", "40", "42", "44", "46", "48", "50", "52", "54", "56", "58", "60"];

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];

export type OrderErrorCode =
  | "unauthenticated" | "permission-denied" | "invalid-argument"
  | "failed-precondition" | "not-found" | "already-exists" | "internal";

export class OrderError extends Error {
  constructor(public code: OrderErrorCode, message: string) {
    super(message);
    this.name = "OrderError";
  }
}

export interface CartLineInput { productId: unknown; quantity: unknown; size?: unknown }
export interface ProductRecord {
  id: string;
  name: string;
  price: number; // INR (rupees) as stored in Firestore
  stock?: number;
  visibility?: string;
  image?: string;
}
export interface PricedItem {
  productId: string;
  name: string;
  size: string;
  quantity: number;
  unitPricePaise: number;
  linePricePaise: number;
  image?: string;
}
export interface Totals {
  items: PricedItem[];
  subtotalPaise: number;
  shippingPaise: number; // 0 at/above the free-shipping threshold; below it the configured fee (refused while unconfirmed)
  totalPaise: number;
  /** Units requested per product (across sizes) for stock reservation. */
  qtyByProduct: Record<string, number>;
}

/**
 * Ordering requires a Firebase user whose PHONE NUMBER IS VERIFIED: either a phone-OTP sign-in, or a Google
 * (or other) sign-in that has had a phone number linked. This is enforced on the server from the signed ID token
 * (`phone_number` claim), so the UI cannot be used to skip it. Anonymous sessions and Google-only users are refused.
 */
export function assertPhoneAuth(auth: { uid?: string; token?: any } | null | undefined): string {
  const fail = () => new OrderError("unauthenticated", "Please sign in and verify your phone number to order.");
  if (!auth || !auth.uid) throw fail();
  const provider = auth.token?.firebase?.sign_in_provider;
  const phone = auth.token?.phone_number;
  if (provider === "anonymous") throw fail();
  if (typeof phone !== "string" || phone.trim() === "") throw fail();
  return auth.uid;
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** Validates the client's cart lines (ids/quantities/sizes only) and prices them from `productsById`. */
export function computeOrderTotals(lines: unknown, productsById: Record<string, ProductRecord | undefined>, shipping: ShippingConfig = DEFAULT_SHIPPING): Totals {
  if (!Array.isArray(lines) || lines.length === 0) throw new OrderError("invalid-argument", "Your cart is empty.");
  if (lines.length > MAX_LINES) throw new OrderError("invalid-argument", "Too many items in the cart.");

  const merged = new Map<string, PricedItem>();
  const qtyByProduct: Record<string, number> = {};

  for (const raw of lines as CartLineInput[]) {
    const productId = raw?.productId;
    const quantity = raw?.quantity;
    const size = raw?.size;
    if (typeof productId !== "string" || !productId || productId.includes("/")) {
      throw new OrderError("invalid-argument", "Invalid product.");
    }
    if (!Number.isInteger(quantity) || (quantity as number) < 1 || (quantity as number) > MAX_QTY_PER_LINE) {
      throw new OrderError("invalid-argument", `Quantity must be between 1 and ${MAX_QTY_PER_LINE}.`);
    }
    if (typeof size !== "string" || !ALLOWED_SIZES.includes(size)) {
      throw new OrderError("invalid-argument", "Please select a valid size.");
    }
    const product = productsById[productId];
    if (!product || product.visibility === "hidden") {
      throw new OrderError("failed-precondition", "An item in your cart is no longer available.");
    }
    if (typeof product.price !== "number" || !Number.isFinite(product.price) || product.price <= 0) {
      throw new OrderError("failed-precondition", "An item in your cart has no valid price.");
    }
    const unit = rupeesToPaise(product.price);
    const key = `${productId}::${size}`;
    const existing = merged.get(key);
    const q = quantity as number;
    if (existing) {
      existing.quantity += q;
      existing.linePricePaise = existing.quantity * unit;
    } else {
      merged.set(key, {
        productId, name: product.name, size, quantity: q,
        unitPricePaise: unit, linePricePaise: unit * q, image: product.image,
      });
    }
    qtyByProduct[productId] = (qtyByProduct[productId] || 0) + q;
  }

  // Stock check across sizes of the same product.
  for (const [productId, qty] of Object.entries(qtyByProduct)) {
    const product = productsById[productId]!;
    const stock = product.stock;
    if (typeof stock !== "number" || !Number.isInteger(stock) || stock < qty) {
      throw new OrderError("failed-precondition", `Only ${Math.max(0, typeof stock === "number" ? stock : 0)} of "${product.name}" left in stock.`);
    }
  }

  const items = Array.from(merged.values());
  const subtotalPaise = items.reduce((sum, i) => sum + i.linePricePaise, 0);
  const shippingPaise = computeShippingPaise(subtotalPaise, shipping);
  return { items, subtotalPaise, shippingPaise, totalPaise: subtotalPaise + shippingPaise, qtyByProduct };
}

export interface ShippingAddress {
  fullName: string; email: string; phone: string;
  addressLine1: string; addressLine2: string; city: string; state: string; postalCode: string; country: "India";
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function validateShippingAddress(raw: any): ShippingAddress {
  const a: ShippingAddress = {
    fullName: str(raw?.fullName, 100),
    email: str(raw?.email, 150).toLowerCase(),
    phone: str(raw?.phone, 10),
    addressLine1: str(raw?.addressLine1, 200),
    addressLine2: str(raw?.addressLine2, 200),
    city: str(raw?.city, 80),
    state: str(raw?.state, 60),
    postalCode: str(raw?.postalCode, 6),
    country: "India",
  };
  if (!a.fullName) throw new OrderError("invalid-argument", "Full name is required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email)) throw new OrderError("invalid-argument", "A valid email is required.");
  if (!/^[6-9]\d{9}$/.test(a.phone)) throw new OrderError("invalid-argument", "A valid 10-digit mobile number is required.");
  if (!a.addressLine1) throw new OrderError("invalid-argument", "Address is required.");
  if (!a.city) throw new OrderError("invalid-argument", "City is required.");
  if (!INDIAN_STATES.includes(a.state)) throw new OrderError("invalid-argument", "A valid state is required.");
  if (!/^\d{6}$/.test(a.postalCode)) throw new OrderError("invalid-argument", "A valid 6-digit pincode is required.");
  return a;
}

function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false; // timingSafeEqual throws on length mismatch
  return crypto.timingSafeEqual(ba, bb);
}

/** Razorpay Checkout signature: HMAC-SHA256(order_id + "|" + payment_id, key_secret). */
export function verifyPaymentSignature(razorpayOrderId: string, razorpayPaymentId: string, signature: string, keySecret: string): boolean {
  if (!keySecret || !razorpayOrderId || !razorpayPaymentId || typeof signature !== "string" || !signature) return false;
  const expected = crypto.createHmac("sha256", keySecret).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

/** Webhook signature: HMAC-SHA256(raw body, webhook secret). An unset secret NEVER validates. */
export function verifyWebhookSignature(rawBody: Buffer | string, signature: unknown, webhookSecret: string): boolean {
  if (!webhookSecret || typeof signature !== "string" || !signature) return false;
  const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}

export interface RazorpayPayment { id: string; order_id: string; status: string; amount: number; currency: string }
export interface StoredOrderPayment { razorpayOrderId?: string; amountPaise: number; currency: string }

/** The payment must be captured and match the stored order's Razorpay order, amount and currency exactly. */
export function assertPaymentMatchesOrder(payment: RazorpayPayment, order: StoredOrderPayment): void {
  if (!payment || payment.status !== "captured") throw new OrderError("failed-precondition", "Payment is not captured.");
  if (!order.razorpayOrderId || payment.order_id !== order.razorpayOrderId) {
    throw new OrderError("permission-denied", "Payment does not belong to this order.");
  }
  if (payment.amount !== order.amountPaise) throw new OrderError("permission-denied", "Payment amount does not match the order.");
  if (payment.currency !== order.currency) throw new OrderError("permission-denied", "Payment currency does not match the order.");
}
