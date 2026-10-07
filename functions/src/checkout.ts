/* eslint-disable */
/**
 * LUXARDO FASHION — server-authoritative checkout (launch hardening, Oct 2026)
 * ============================================================================
 * Before this, the browser computed the amount and wrote the order document
 * itself (including paymentStatus "paid"), so a customer could pay ₹1 for any
 * product or create a fake paid order, and a customer who closed the browser
 * right after paying lost the order entirely.
 *
 * Now:
 *  - createRazorpayOrder: receives only {productId, size, quantity} lines plus
 *    the address. Prices come from Firestore `products`. The server creates
 *    the Razorpay order for that amount AND the `orders` document up-front
 *    (paymentStatus "pending", awaitingPayment true).
 *  - verifyRazorpayPayment: verifies the Razorpay signature and marks that
 *    order paid (status "processing"), decrements stock, sends emails.
 *  - razorpayWebhook (index.ts) calls the same markOrderPaid(), so an order is
 *    confirmed even if the customer's browser closed after paying.
 *  - createCodOrder: same server pricing for Cash on Delivery.
 *  - Firestore rules no longer allow clients to create orders.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import Razorpay from "razorpay";
import { sendOrderEmails, resendApiKey } from "./emailSender";

export const RAZORPAY_KEY_ID = defineSecret("RAZORPAY_KEY_ID");
export const RAZORPAY_KEY_SECRET = defineSecret("RAZORPAY_KEY_SECRET");

const db = () => admin.firestore();

/* Mirrors src/constants/businessConfig.ts — keep in sync. */
const COD_PINS = new Set([
  "311001", "312001", "305008",
  "302001", "302002", "302003", "302004", "302005", "302006",
  "302012", "302013", "302015", "302016", "302017", "302018",
  "302020", "302021", "302022", "302026", "302027", "302029",
  "302031", "303033", "302039", "302040", "302041", "302042",
  "302044", "302046", "302048",
  "303001", "303050",
]);
const COD_MAX_ORDER_VALUE = 200000;
const MAX_LINES = 30;
const MAX_QTY_PER_LINE = 20;

type CartLine = { productId: string; size?: string; quantity: number };

export type PricedLine = {
  productId: string; name: string; title: string; image: string;
  size: string; quantity: number; price: number; subtotal: number;
};

function str(v: unknown, max = 300): string {
  return String(v ?? "").trim().slice(0, max);
}

/** Validate and normalise the address/customer block sent by the browser. */
export function cleanAddress(raw: any) {
  const a = raw || {};
  const out = {
    fullName: str(a.fullName, 120),
    email: str(a.email, 200).toLowerCase(),
    phone: str(a.phone, 20),
    addressLine1: str(a.addressLine1, 200),
    addressLine2: str(a.addressLine2, 200),
    city: str(a.city, 80),
    state: str(a.state, 80),
    postalCode: str(a.postalCode, 10),
    country: "India",
  };
  if (!out.fullName || !out.addressLine1 || !out.city || !out.state) {
    throw new HttpsError("invalid-argument", "Name, address, city and state are required.");
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(out.email)) throw new HttpsError("invalid-argument", "A valid email is required.");
  if (!/^\+?\d{10,13}$/.test(out.phone.replace(/[\s-]/g, ""))) throw new HttpsError("invalid-argument", "A valid phone number is required.");
  if (!/^\d{6}$/.test(out.postalCode)) throw new HttpsError("invalid-argument", "A valid 6-digit pincode is required.");
  return out;
}

/**
 * Price a cart from Firestore. Pure aside from the product reads, exported
 * for tests. Throws if a product is missing, hidden, or out of stock.
 */
export async function priceCart(rawItems: unknown): Promise<{ lines: PricedLine[]; total: number }> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) throw new HttpsError("invalid-argument", "Your cart is empty.");
  if (rawItems.length > MAX_LINES) throw new HttpsError("invalid-argument", "Too many items in one order.");
  const items: CartLine[] = rawItems.map((r: any) => ({
    productId: str(r?.productId, 120),
    size: str(r?.size, 40) || "N/A",
    quantity: Math.floor(Number(r?.quantity)),
  }));
  for (const it of items) {
    if (!it.productId) throw new HttpsError("invalid-argument", "Invalid cart item.");
    if (!Number.isFinite(it.quantity) || it.quantity < 1 || it.quantity > MAX_QTY_PER_LINE) {
      throw new HttpsError("invalid-argument", "Invalid quantity in cart.");
    }
  }
  const ids = [...new Set(items.map((i) => i.productId))];
  const snaps = await Promise.all(ids.map((id) => db().doc(`products/${id}`).get()));
  const byId = new Map(snaps.map((s) => [s.id, s]));
  const wanted = new Map<string, number>();
  items.forEach((i) => wanted.set(i.productId, (wanted.get(i.productId) || 0) + i.quantity));

  const lines: PricedLine[] = items.map((it) => {
    const s = byId.get(it.productId);
    const p = s?.exists ? s.data()! : null;
    if (!p || p.visibility === "hidden") throw new HttpsError("failed-precondition", "A product in your cart is no longer available. Please refresh your cart.");
    const price = Number(p.price);
    if (!Number.isFinite(price) || price <= 0) throw new HttpsError("failed-precondition", `${p.name || "A product"} has no valid price.`);
    if (typeof p.stock === "number" && p.stock < (wanted.get(it.productId) || 0)) {
      throw new HttpsError("failed-precondition", `Only ${Math.max(0, p.stock)} left of ${p.name}. Please reduce the quantity.`);
    }
    const name = String(p.name || "Product");
    return {
      productId: it.productId, name, title: name, image: String(p.image || ""),
      size: it.size || "N/A", quantity: it.quantity, price, subtotal: Math.round(price * it.quantity * 100) / 100,
    };
  });
  const total = Math.round(lines.reduce((s, l) => s + l.subtotal, 0) * 100) / 100;
  return { lines, total };
}

function baseOrder(uid: string, authEmail: string | undefined, addr: ReturnType<typeof cleanAddress>, lines: PricedLine[], total: number) {
  return {
    userId: uid,
    userEmail: addr.email || authEmail || "",
    userName: addr.fullName,
    createdAt: new Date().toISOString(),
    totalAmount: total,
    items: lines,
    customer: { fullName: addr.fullName, email: addr.email, phone: addr.phone },
    shippingAddress: addr,
    courierPartner: "DTDC",
    trackingId: null,
    serverCreated: true,
  };
}

/** Decrement product stock for an order (only products that track stock). */
function decrementStock(tx: admin.firestore.Transaction, productSnaps: admin.firestore.DocumentSnapshot[], lines: PricedLine[]) {
  const qty = new Map<string, number>();
  lines.forEach((l) => qty.set(l.productId, (qty.get(l.productId) || 0) + l.quantity));
  for (const s of productSnaps) {
    const p = s.data();
    if (p && typeof p.stock === "number") {
      tx.update(s.ref, { stock: Math.max(0, p.stock - (qty.get(s.id) || 0)), updatedAt: new Date().toISOString() });
    }
  }
}

/**
 * Mark an order paid exactly once (shared by verifyRazorpayPayment and the
 * webhook). Returns true when this call performed the transition.
 */
export async function markOrderPaid(orderRef: admin.firestore.DocumentReference, razorpayOrderId: string, paymentId: string, source: string): Promise<boolean> {
  let didTransition = false;
  let orderData: any = null;
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists) throw new HttpsError("not-found", "Order not found.");
    const o = snap.data()!;
    if (o.razorpay?.orderId !== razorpayOrderId) throw new HttpsError("permission-denied", "Payment does not belong to this order.");
    if (o.paymentStatus === "paid") return;
    const ids = [...new Set((o.items || []).map((l: any) => l.productId))] as string[];
    const productSnaps = await Promise.all(ids.map((id) => tx.get(db().doc(`products/${id}`))));
    const now = new Date().toISOString();
    tx.update(orderRef, {
      paymentStatus: "paid",
      status: "processing",
      awaitingPayment: false,
      paidAt: now,
      "razorpay.paymentId": paymentId,
      "razorpay.verifiedAt": now,
      "razorpay.verifiedBy": source,
      emailSentAt: now,
    });
    decrementStock(tx, productSnaps, o.items || []);
    didTransition = true;
    orderData = { id: orderRef.id, ...o, paymentStatus: "paid", status: "processing" };
  });
  if (didTransition && orderData) await sendOrderEmails(orderData);
  return didTransition;
}

/* ═══════════════════════════════════════════════════════════════════
 * createRazorpayOrder
 * Input : { items: [{productId, size, quantity}], address: {...} }
 * Output: { orderId, razorpayOrderId, amount, currency }
 * ═══════════════════════════════════════════════════════════════════ */
export const createRazorpayOrder = onCall(
  { secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in (or guest checkout) required.");
    const addr = cleanAddress(request.data?.address);
    const { lines, total } = await priceCart(request.data?.items);
    const amountPaise = Math.round(total * 100);
    if (amountPaise < 100) throw new HttpsError("invalid-argument", "Order total must be at least ₹1.");

    const orderRef = db().collection("orders").doc();
    let rzpOrder: { id: string; amount: number; currency: string };
    if (process.env.FUNCTIONS_EMULATOR === "true" && process.env.RAZORPAY_MOCK === "1") {
      rzpOrder = { id: `order_mock_${orderRef.id}`, amount: amountPaise, currency: "INR" };
    } else {
      try {
        const rzp = new Razorpay({ key_id: RAZORPAY_KEY_ID.value(), key_secret: RAZORPAY_KEY_SECRET.value() });
        const o: any = await rzp.orders.create({
          amount: amountPaise, currency: "INR", receipt: orderRef.id,
          notes: { orderId: orderRef.id, uid: request.auth.uid },
        });
        rzpOrder = { id: o.id, amount: Number(o.amount), currency: String(o.currency) };
      } catch (err: any) {
        console.error("createRazorpayOrder: Razorpay API failed", err);
        throw new HttpsError("internal", err?.error?.description || "Could not start payment. Please try again.");
      }
    }

    await orderRef.set({
      ...baseOrder(request.auth.uid, request.auth.token?.email, addr, lines, total),
      // Unpaid until verified. status stays in the existing admin vocabulary;
      // paymentMethod razorpay + paymentStatus pending = payment not completed.
      status: "pending",
      paymentStatus: "pending",
      paymentMethod: "razorpay",
      awaitingPayment: true,
      razorpay: { orderId: rzpOrder.id, amount: rzpOrder.amount, currency: rzpOrder.currency },
    });
    return { orderId: orderRef.id, razorpayOrderId: rzpOrder.id, amount: rzpOrder.amount, currency: rzpOrder.currency };
  }
);

/* ═══════════════════════════════════════════════════════════════════
 * verifyRazorpayPayment
 * Input : { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature }
 * Output: { verified, orderId }
 * ═══════════════════════════════════════════════════════════════════ */
export const verifyRazorpayPayment = onCall(
  { secrets: [RAZORPAY_KEY_SECRET, resendApiKey] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
    const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = (request.data || {}) as Record<string, string>;
    if (!orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new HttpsError("invalid-argument", "Missing payment fields.");
    }
    const expected = crypto.createHmac("sha256", RAZORPAY_KEY_SECRET.value())
      .update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
    let verified = false;
    try {
      verified = expected.length === razorpay_signature.length &&
        crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(razorpay_signature, "hex"));
    } catch { verified = false; }
    if (!verified) {
      console.error("Razorpay signature mismatch", { orderId, razorpay_order_id, razorpay_payment_id });
      return { verified: false, orderId };
    }
    const ref = db().doc(`orders/${orderId}`);
    const snap = await ref.get();
    if (!snap.exists || snap.data()!.userId !== request.auth.uid) throw new HttpsError("permission-denied", "Order not found for this user.");
    await markOrderPaid(ref, razorpay_order_id, razorpay_payment_id, "client-verify");
    return { verified: true, orderId };
  }
);

/* ═══════════════════════════════════════════════════════════════════
 * createCodOrder — Cash on Delivery, server-priced.
 * Input : { items, address }   Output: { orderId, totalAmount }
 * ═══════════════════════════════════════════════════════════════════ */
export const createCodOrder = onCall(
  { secrets: [resendApiKey] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in (or guest checkout) required.");
    const addr = cleanAddress(request.data?.address);
    if (!COD_PINS.has(addr.postalCode)) throw new HttpsError("failed-precondition", "Cash on Delivery is not available for this pincode. Please pay online.");
    const { lines, total } = await priceCart(request.data?.items);
    if (total > COD_MAX_ORDER_VALUE) throw new HttpsError("failed-precondition", "This order is above the Cash on Delivery limit. Please pay online.");

    const orderRef = db().collection("orders").doc();
    const order = {
      ...baseOrder(request.auth.uid, request.auth.token?.email, addr, lines, total),
      status: "pending",
      paymentStatus: "pending",
      paymentMethod: "COD",
      emailSentAt: new Date().toISOString(),
    };
    await db().runTransaction(async (tx) => {
      const ids = [...new Set(lines.map((l) => l.productId))];
      const productSnaps = await Promise.all(ids.map((id) => tx.get(db().doc(`products/${id}`))));
      for (const s of productSnaps) {
        const p = s.data();
        const need = lines.filter((l) => l.productId === s.id).reduce((n, l) => n + l.quantity, 0);
        if (p && typeof p.stock === "number" && p.stock < need) {
          throw new HttpsError("failed-precondition", `Only ${Math.max(0, p.stock)} left of ${p.name}. Please reduce the quantity.`);
        }
      }
      tx.set(orderRef, order);
      decrementStock(tx, productSnaps, lines);
    });
    await sendOrderEmails({ id: orderRef.id, ...order });
    return { orderId: orderRef.id, totalAmount: total };
  }
);
