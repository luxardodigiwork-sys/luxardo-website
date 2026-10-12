/**
 * Order/stock/payment state machine on Firestore (Admin SDK).
 *
 * Order lifecycle (status vocabulary shared with the admin/dispatch screens):
 *   pending (paymentStatus pending) --(captured payment)--> processing (paymentStatus paid)
 *   pending --(expiry sweep)------------------------------> cancelled  (statusReason payment_window_elapsed, stock released)
 *   pending/processing --(admin cancel)-------------------> cancelled  (stock released once)
 *   paid after the reservation expired and stock is gone --> on_hold   (needsRefund)
 *
 * Stock is RESERVED (decremented) when the order is created and RELEASED at most once
 * (guarded by `stockReserved` / `stockReleased`). Every payment transition is idempotent:
 * a second delivery of the same payment/webhook changes nothing.
 */
import type { Firestore, Transaction } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import {
  CURRENCY, MAX_PENDING_ORDERS_PER_USER, PAYMENT_WINDOW_MINUTES, OrderError,
  ProductRecord, RazorpayPayment, ShippingAddress, ShippingConfig, DEFAULT_SHIPPING, assertPaymentMatchesOrder, computeOrderTotals, evaluateCancellation, evaluateReturn,
} from "./core";
import { MAIL_COLLECTION, buildMailDocs } from "./emails";

export interface RazorpayLike {
  orders: { create(opts: { amount: number; currency: string; receipt: string; notes?: Record<string, string> }): Promise<{ id: string; amount: number | string; currency: string }> };
  payments: { fetch(paymentId: string): Promise<RazorpayPayment> };
}

export interface CreateOrderInput {
  uid: string;
  phone?: string;
  lines: unknown;
  address: ShippingAddress;
  now?: Date;
  /** Shipping rule; defaults to the confirmed business rule. Overridable for tests only. */
  shipping?: ShippingConfig;
  /** Client-generated retry key. The same key from the same user always maps to the same order (no duplicate orders on double-click/retry). */
  requestId?: string;
  /** The total (paise) the customer saw before paying. The server stays authoritative: if its own total differs, nothing is created. */
  expectedTotalPaise?: number;
}

export const PRICE_CHANGED_MESSAGE = "The price or shipping for your cart changed since you opened checkout. Please review your cart and try again.";

export interface CreatedOrder {
  orderId: string;
  razorpayOrderId: string;
  amountPaise: number;
  currency: string;
  total: number;
}

const productRef = (db: Firestore, id: string) => db.collection("products").doc(id);

function toProduct(id: string, data: FirebaseFirestore.DocumentData | undefined): ProductRecord | undefined {
  if (!data) return undefined;
  return { id, name: data.name, price: data.price, stock: data.stock, visibility: data.visibility, image: data.image };
}

/** Validates + prices the cart on the server, reserves stock, creates the Razorpay order. */
export async function createCheckoutOrder(db: Firestore, rzp: RazorpayLike, input: CreateOrderInput): Promise<CreatedOrder> {
  const now = input.now ?? new Date();

  const requestId = typeof input.requestId === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(input.requestId) ? input.requestId : undefined;
  const orderRef = requestId ? db.collection("orders").doc(`${input.uid}_${requestId}`) : db.collection("orders").doc();

  if (requestId) {
    const prior = await orderRef.get();
    if (prior.exists) return resumeExistingOrder(rzp, orderRef, prior.data()!, input.expectedTotalPaise);
  }

  // Anti-hoarding: cap concurrent unpaid orders per user.
  const open = await db.collection("orders").where("userId", "==", input.uid).where("paymentStatus", "==", "pending").get();
  const stillOpen = open.docs.filter((d) => d.data().status === "pending" && (d.data().expiresAt as string) > now.toISOString());
  if (stillOpen.length >= MAX_PENDING_ORDERS_PER_USER) {
    throw new OrderError("failed-precondition", "You have too many unpaid orders. Please complete or wait for them to expire.");
  }

  const lines = input.lines as Array<{ productId?: unknown }>;
  const ids = Array.isArray(lines)
    ? Array.from(new Set(lines.map((l) => l?.productId).filter((v): v is string => typeof v === "string" && !!v && !v.includes("/"))))
    : [];

  let raced: FirebaseFirestore.DocumentData | undefined;
  const totals = await db.runTransaction(async (tx) => {
    raced = undefined;
    if (requestId) {
      const again = await tx.get(orderRef); // a concurrent identical request may have created it meanwhile
      if (again.exists) { raced = again.data(); return null; }
    }
    const snaps = await Promise.all(ids.map((id) => tx.get(productRef(db, id))));
    const productsById: Record<string, ProductRecord | undefined> = {};
    snaps.forEach((s, i) => { productsById[ids[i]] = toProduct(ids[i], s.data()); });

    const t = computeOrderTotals(input.lines, productsById, input.shipping ?? DEFAULT_SHIPPING); // throws on bad ids/qty/size/price/stock/shipping
    // Client/server agreement BEFORE anything is reserved or created: a stale cart must not silently pay a different amount.
    if (input.expectedTotalPaise !== undefined && input.expectedTotalPaise !== t.totalPaise) throw new OrderError("failed-precondition", PRICE_CHANGED_MESSAGE);

    for (const [productId, qty] of Object.entries(t.qtyByProduct)) {
      tx.update(productRef(db, productId), { stock: FieldValue.increment(-qty), updatedAt: now.toISOString() });
    }

    tx.set(orderRef, {
      userId: input.uid,
      userName: input.address.fullName,
      userEmail: input.address.email,
      userPhone: input.phone ?? "",
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + PAYMENT_WINDOW_MINUTES * 60_000).toISOString(),
      status: "pending",
      paymentStatus: "pending",
      paymentMethod: "razorpay",
      currency: CURRENCY,
      amountPaise: t.totalPaise,
      subtotalAmount: t.subtotalPaise / 100,
      shippingAmount: t.shippingPaise / 100, // free at/above the threshold
      totalAmount: t.totalPaise / 100,
      taxAmount: null, // GST treatment not confirmed by the business; no tax is added
      taxTreatment: "unconfirmed",
      items: t.items.map((i) => ({
        productId: i.productId, title: i.name, name: i.name, size: i.size, quantity: i.quantity,
        price: i.unitPricePaise / 100, subtotal: i.linePricePaise / 100, image: i.image ?? null,
      })),
      customer: { fullName: input.address.fullName, email: input.address.email, phone: input.address.phone },
      shippingAddress: input.address,
      courierPartner: "DTDC",
      trackingId: null,
      stockReserved: true,
      stockReleased: false,
      qtyByProduct: t.qtyByProduct,
      razorpayOrderId: null,
      razorpayPaymentId: null,
    });
    return t;
  });

  if (!totals) return resumeExistingOrder(rzp, orderRef, raced!, input.expectedTotalPaise);

  try {
    const rz = await rzp.orders.create({
      amount: totals.totalPaise,
      currency: CURRENCY,
      receipt: orderRef.id,
      notes: { orderId: orderRef.id, uid: input.uid },
    });
    await orderRef.update({ razorpayOrderId: rz.id });
    return { orderId: orderRef.id, razorpayOrderId: rz.id, amountPaise: totals.totalPaise, currency: CURRENCY, total: totals.totalPaise / 100 };
  } catch (err) {
    // Compensate: nothing was payable, so give the stock back and close the order.
    await releaseOrderStock(db, orderRef.id, "payment_provider_error", { onlyIfUnpaid: true }).catch(() => undefined);
    throw err;
  }
}

/** Same user + same requestId: hand back the existing order instead of creating (and charging for) a second one. */
async function resumeExistingOrder(rzp: RazorpayLike, ref: FirebaseFirestore.DocumentReference, o: FirebaseFirestore.DocumentData, expectedTotalPaise?: number): Promise<CreatedOrder> {
  if (expectedTotalPaise !== undefined && expectedTotalPaise !== o.amountPaise) throw new OrderError("failed-precondition", PRICE_CHANGED_MESSAGE);
  if (o.status !== "pending" || o.paymentStatus !== "pending") {
    throw new OrderError("failed-precondition", "This order has already been processed. Please refresh and check your orders.");
  }
  let razorpayOrderId = o.razorpayOrderId as string | null;
  if (!razorpayOrderId) { // an earlier attempt reserved stock but died before the payment order was created
    const rz = await rzp.orders.create({ amount: o.amountPaise, currency: o.currency, receipt: ref.id, notes: { orderId: ref.id, uid: o.userId } });
    razorpayOrderId = rz.id;
    await ref.update({ razorpayOrderId });
  }
  return { orderId: ref.id, razorpayOrderId: razorpayOrderId as string, amountPaise: o.amountPaise, currency: o.currency, total: o.amountPaise / 100 };
}

/** Restores reserved stock exactly once and moves the order to `nextStatus`. Safe to call repeatedly. */
export async function releaseOrderStock(db: Firestore, orderId: string, reason: string, opts: { onlyIfUnpaid?: boolean } = {}): Promise<boolean> {
  return db.runTransaction(async (tx) => {
    const ref = db.collection("orders").doc(orderId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new OrderError("not-found", "Order not found.");
    const o = snap.data()!;
    // Automatic releases (expiry sweep, provider-error rollback) act on a possibly STALE view of the order. Re-check inside
    // the transaction: if the payment landed in the meantime, a paid order must never be cancelled by them.
    if (opts.onlyIfUnpaid && (o.paymentStatus !== "pending" || o.status !== "pending")) return false;
    if (!o.stockReserved || o.stockReleased) {
      if (o.status === "pending" && o.paymentStatus === "pending") tx.update(ref, { status: "cancelled", statusReason: reason });
      return false;
    }
    const qty = (o.qtyByProduct || {}) as Record<string, number>;
    for (const [pid, q] of Object.entries(qty)) {
      tx.update(productRef(db, pid), { stock: FieldValue.increment(q) });
    }
    const paid = o.paymentStatus === "paid" || o.paymentStatus === "confirmed";
    tx.update(ref, {
      stockReleased: true, status: "cancelled", statusReason: reason, cancelledAt: new Date().toISOString(),
      ...(paid ? { needsRefund: true } : {}), // a paid order that is cancelled must be refunded by staff (not automatic)
    });
    return true;
  });
}

export type PaymentResult =
  | { result: "paid" }
  | { result: "already_paid" }
  | { result: "duplicate_event" }
  | { result: "paid_stock_unavailable" }
  | { result: "paid_order_cancelled" };

export interface ApplyPaymentInput {
  orderId?: string;           // known order (verify flow)
  razorpayOrderId?: string;   // lookup key (webhook flow)
  payment: RazorpayPayment;
  eventId?: string;           // webhook dedupe key
  ownerNotifyEmail?: string;  // optional: queue an owner notification mail too
}

/**
 * Marks an order paid after a CAPTURED payment that matches the stored Razorpay order,
 * amount and currency. Used by both the client verify flow and the webhook.
 */
export async function applyCapturedPayment(db: Firestore, input: ApplyPaymentInput): Promise<PaymentResult> {
  let orderRef: FirebaseFirestore.DocumentReference;
  if (input.orderId) {
    orderRef = db.collection("orders").doc(input.orderId);
  } else if (input.razorpayOrderId) {
    const q = await db.collection("orders").where("razorpayOrderId", "==", input.razorpayOrderId).limit(1).get();
    if (q.empty) throw new OrderError("not-found", "Order not found.");
    orderRef = q.docs[0].ref;
  } else {
    throw new OrderError("invalid-argument", "Missing order reference.");
  }
  const eventRef = input.eventId ? db.collection("webhookEvents").doc(input.eventId) : null;

  return db.runTransaction(async (tx: Transaction): Promise<PaymentResult> => {
    const [orderSnap, eventSnap] = await Promise.all([tx.get(orderRef), eventRef ? tx.get(eventRef) : Promise.resolve(null)]);
    if (eventSnap && eventSnap.exists) return { result: "duplicate_event" };
    if (!orderSnap.exists) throw new OrderError("not-found", "Order not found.");
    const o = orderSnap.data()!;

    assertPaymentMatchesOrder(input.payment, { razorpayOrderId: o.razorpayOrderId, amountPaise: o.amountPaise, currency: o.currency });

    const markEvent = () => { if (eventRef) tx.set(eventRef, { type: "payment.captured", orderId: orderRef.id, paymentId: input.payment.id, at: new Date().toISOString() }); };

    if (o.paymentStatus === "paid") {
      markEvent();
      if (o.razorpayPaymentId && o.razorpayPaymentId !== input.payment.id) {
        // A second, different payment captured for an already-paid order: flag for manual refund.
        tx.update(orderRef, { duplicatePaymentIds: FieldValue.arrayUnion(input.payment.id), needsRefund: true });
      }
      return { result: "already_paid" };
    }

    // The customer/admin deliberately cancelled this order: do NOT revive it. Record the payment and flag a refund.
    if (o.status === "cancelled" && (o.statusReason === "cancelled_by_customer" || o.statusReason === "cancelled_by_admin")) {
      const at = new Date().toISOString();
      tx.update(orderRef, {
        paymentStatus: "paid", razorpayPaymentId: input.payment.id, paidAt: at, paymentVerifiedAt: at,
        needsRefund: true, statusReason: "paid_after_cancellation",
      });
      markEvent();
      return { result: "paid_order_cancelled" };
    }

    let stockOk = true;
    if (o.stockReleased) {
      // Paid after the reservation expired: try to reserve again; otherwise hold for refund.
      const qty = (o.qtyByProduct || {}) as Record<string, number>;
      const ids = Object.keys(qty);
      const snaps = await Promise.all(ids.map((id) => tx.get(productRef(db, id))));
      stockOk = snaps.every((s, i) => s.exists && typeof s.data()!.stock === "number" && s.data()!.stock >= qty[ids[i]]);
      if (stockOk) ids.forEach((id) => tx.update(productRef(db, id), { stock: FieldValue.increment(-qty[id]) }));
    }

    const paidAt = new Date().toISOString();
    tx.update(orderRef, {
      paymentStatus: "paid",
      razorpayPaymentId: input.payment.id,
      paidAt,
      paymentVerifiedAt: paidAt,
      status: stockOk ? "processing" : "on_hold",
      stockReserved: stockOk ? true : o.stockReserved,
      stockReleased: stockOk ? false : o.stockReleased,
      ...(stockOk ? {} : { needsRefund: true, statusReason: "paid_after_expiry_stock_unavailable" }),
    });
    markEvent();
    if (stockOk) {
      // Queue confirmation mail(s) in the same transaction as the paid transition (deterministic ids => once per order).
      for (const m of buildMailDocs(orderRef.id, { ...o, razorpayPaymentId: input.payment.id, paidAt }, input.ownerNotifyEmail)) {
        tx.set(db.collection(MAIL_COLLECTION).doc(m.id), { ...m.data, orderId: orderRef.id, queuedAt: paidAt });
      }
    }
    return stockOk ? { result: "paid" } : { result: "paid_stock_unavailable" };
  });
}

/** Records a failed payment attempt (webhook). Does NOT release stock: the customer may retry the same order. */
export async function recordPaymentFailure(db: Firestore, input: { razorpayOrderId: string; paymentId: string; reason?: string; eventId: string }): Promise<"recorded" | "duplicate_event" | "ignored"> {
  const q = await db.collection("orders").where("razorpayOrderId", "==", input.razorpayOrderId).limit(1).get();
  const eventRef = db.collection("webhookEvents").doc(input.eventId);
  return db.runTransaction(async (tx) => {
    // all reads first, then writes
    const orderRef = q.empty ? null : q.docs[0].ref;
    const [ev, orderSnap] = await Promise.all([tx.get(eventRef), orderRef ? tx.get(orderRef) : Promise.resolve(null)]);
    if (ev.exists) return "duplicate_event" as const;
    tx.set(eventRef, { type: "payment.failed", paymentId: input.paymentId, at: new Date().toISOString() });
    if (!orderRef || !orderSnap || !orderSnap.exists) return "ignored" as const;
    if (orderSnap.data()!.paymentStatus !== "paid") {
      tx.update(orderRef, { lastPaymentError: input.reason ?? "payment_failed", lastFailedPaymentId: input.paymentId });
    }
    return "recorded" as const;
  });
}

/** Client verify flow: signature already checked by the caller; confirm with Razorpay and apply. */
export async function verifyAndApplyPayment(db: Firestore, rzp: RazorpayLike, input: { uid: string; orderId: string; razorpayPaymentId: string; ownerNotifyEmail?: string }): Promise<PaymentResult | { result: "pending" }> {
  const snap = await db.collection("orders").doc(input.orderId).get();
  if (!snap.exists || snap.data()!.userId !== input.uid) throw new OrderError("not-found", "Order not found."); // ownership
  const payment = await rzp.payments.fetch(input.razorpayPaymentId);
  if (payment.order_id !== snap.data()!.razorpayOrderId) throw new OrderError("permission-denied", "Payment does not belong to this order.");
  if (payment.status !== "captured") return { result: "pending" }; // webhook completes it once captured
  return applyCapturedPayment(db, { orderId: input.orderId, payment, ownerNotifyEmail: input.ownerNotifyEmail });
}

/** Expiry sweep: releases stock for unpaid orders past their payment window. */
export async function releaseExpiredOrders(db: Firestore, now: Date = new Date(), limit = 200): Promise<number> {
  const q = await db.collection("orders").where("expiresAt", "<", now.toISOString()).limit(limit).get();
  let released = 0;
  for (const d of q.docs) {
    if (d.data().status !== "pending" || d.data().paymentStatus !== "pending") continue;
    if (await releaseOrderStock(db, d.id, "payment_window_elapsed", { onlyIfUnpaid: true })) released++;
  }
  return released;
}

export type CancellationOutcome = { outcome: "cancelled" } | { outcome: "requested" };

/**
 * Customer-initiated cancellation. Re-checks everything inside one transaction so a payment landing at the same
 * moment cannot be cancelled without a refund:
 *  - unpaid pending order  -> cancelled now, reserved stock released once
 *  - paid + processing, within 24h -> only records a cancellation REQUEST; staff approve it and refund manually
 */
export async function requestCancellation(db: Firestore, input: { uid: string; orderId: string; reason?: string; now?: Date }): Promise<CancellationOutcome> {
  const now = input.now ?? new Date();
  const ref = db.collection("orders").doc(input.orderId);
  return db.runTransaction(async (tx): Promise<CancellationOutcome> => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data()!.userId !== input.uid) throw new OrderError("not-found", "Order not found.");
    const o = snap.data()!;
    const verdict = evaluateCancellation(o, now);
    if (!verdict.allowed) throw new OrderError("failed-precondition", verdict.reason || "This order cannot be cancelled online.");

    const reason = typeof input.reason === "string" ? input.reason.trim().slice(0, 300) : "";
    if (verdict.mode === "request") {
      tx.update(ref, { cancellationRequest: { requestedAt: now.toISOString(), reason, status: "requested" } });
      return { outcome: "requested" };
    }
    // cancel_unpaid
    const qty = (o.qtyByProduct || {}) as Record<string, number>;
    if (o.stockReserved && !o.stockReleased) {
      for (const [pid, q] of Object.entries(qty)) tx.update(productRef(db, pid), { stock: FieldValue.increment(q) });
    }
    tx.update(ref, { stockReleased: true, status: "cancelled", statusReason: "cancelled_by_customer", cancelledAt: now.toISOString() });
    return { outcome: "cancelled" };
  });
}

export interface ReturnOutcome { outcome: "requested" }

/** Records a customer's return request (within 7 days of delivery). Staff review it; no refund is ever automatic. */
export async function requestReturn(db: Firestore, input: { uid: string; orderId: string; reason?: string; now?: Date }): Promise<ReturnOutcome> {
  const now = input.now ?? new Date();
  const ref = db.collection("orders").doc(input.orderId);
  return db.runTransaction(async (tx): Promise<ReturnOutcome> => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data()!.userId !== input.uid) throw new OrderError("not-found", "Order not found.");
    const verdict = evaluateReturn(snap.data()!, now);
    if (!verdict.allowed) throw new OrderError("failed-precondition", verdict.reason || "This order cannot be returned online.");
    const reason = typeof input.reason === "string" ? input.reason.trim().slice(0, 500) : "";
    tx.update(snap.ref, { returnRequest: { requestedAt: now.toISOString(), reason, status: "requested", deliveredAt: verdict.deliveredAt } });
    return { outcome: "requested" };
  });
}
