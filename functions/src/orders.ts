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
  ProductRecord, RazorpayPayment, ShippingAddress, ShippingConfig, DEFAULT_SHIPPING, razorpayReceiptForOrder, assertPaymentMatchesOrder, computeOrderTotals, evaluateCancellation, evaluateReturn,
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
  /** How long a repeat request waits for a payment order another request is creating (ms). Overridable for tests only. */
  paymentOrderWaitMs?: number;
  /** The total (paise) the customer saw before paying. The server stays authoritative: if its own total differs, nothing is created. */
  expectedTotalPaise?: number;
}

/**
 * Razorpay's documented Orders API does not expose a create-order idempotency key.
 * An ambiguous attempt must not be taken over automatically: the provider may have
 * created an order even if this process never persisted its ID.
 */
const PAYMENT_ORDER_WAIT_MS = 10_000;
const PAYMENT_ORDER_POLL_MS = 100;

export const PRICE_CHANGED_MESSAGE = "The price or shipping for your cart changed since you opened checkout. Please review your cart and try again.";

export interface CreatedOrder {
  orderId: string;
  razorpayOrderId: string;
  amountPaise: number;
  currency: string;
  total: number;
}

const productRef = (db: Firestore, id: string) => db.collection("products").doc(id);

/**
 * Customers can read their own `orders/{id}` document, and Firestore cannot hide single fields. Staff-only data therefore lives in
 * `orderInternal/{id}` (readable by admin/owner/dispatch only, see firestore.rules): refund flags, payment errors and duplicate-payment
 * metadata written here, plus the staff-written remarks, assignment and verification fields. NEVER write these onto the order itself.
 */
export const INTERNAL_ORDER_COLLECTION = "orderInternal";
export const SERVER_INTERNAL_FIELDS = ["needsRefund", "lastPaymentError", "lastFailedPaymentId", "duplicatePaymentIds"] as const;
const internalRef = (db: Firestore, orderId: string) => db.collection(INTERNAL_ORDER_COLLECTION).doc(orderId);

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
    if (prior.exists) return resumeExistingOrder(db, rzp, orderRef, prior.data()!, input.expectedTotalPaise, input.paymentOrderWaitMs);
  }

  // Anti-hoarding: cap concurrent unpaid orders per user.
  const open = await db.collection("orders").where("userId", "==", input.uid).where("paymentStatus", "==", "pending").get();
  const stillOpen = open.docs.filter((d) => d.data().status === "pending" && ((d.data().expiresAt as string) > now.toISOString() || paymentSetupUnresolved(d.data())));
  if (stillOpen.length >= MAX_PENDING_ORDERS_PER_USER) {
    throw new OrderError("failed-precondition", "You have too many unpaid orders. Complete them or contact support if payment setup needs review.");
  }

  const lines = input.lines as Array<{ productId?: unknown }>;
  const ids = Array.isArray(lines)
    ? Array.from(new Set(lines.map((l) => l?.productId).filter((v): v is string => typeof v === "string" && !!v && !v.includes("/"))))
    : [];

  let raced: FirebaseFirestore.DocumentData | undefined;
  const attemptId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
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
      razorpayReceipt: razorpayReceiptForOrder(orderRef.id),
      razorpayOrderId: null,
      razorpayPaymentId: null,
      rzpOrderCreationState: "creating",
      rzpOrderAttemptId: attemptId,
      rzpOrderPendingAt: new Date().toISOString(), // diagnostic only; never authorizes a second external create
    });
    return t;
  });

  if (!totals) return resumeExistingOrder(db, rzp, orderRef, raced!, input.expectedTotalPaise, input.paymentOrderWaitMs);

  let rz: { id: string; amount: number | string; currency: string };
  try {
    // Receipt/notes are reconciliation metadata, not documented idempotency guarantees.
    rz = await rzp.orders.create({
      amount: totals.totalPaise,
      currency: CURRENCY,
      receipt: razorpayReceiptForOrder(orderRef.id),
      notes: { orderId: orderRef.id, uid: input.uid },
    });
  } catch (err) {
    if (isDefinitiveProviderRejection(err)) {
      // Razorpay answered with an HTTP 4xx: the request was rejected, so no provider order exists. It is safe (and
      // correct) to give the stock back and let the customer start over, instead of parking the order for reconciliation.
      const e = err as { statusCode?: number; error?: { code?: string; description?: string } };
      console.error("Razorpay rejected order creation", { orderId: orderRef.id, statusCode: e.statusCode, code: e.error?.code, description: e.error?.description });
      await releaseOrderStock(db, orderRef.id, "payment_provider_error", { onlyIfUnpaid: true }).catch(() => undefined);
      throw new OrderError("failed-precondition", "We could not start your payment right now. Nothing was charged. Please try again in a few minutes.");
    }
    // Timeout / network error / 5xx: the provider may or may not have created the order. Never release or recreate.
    await markPaymentOrderReconciliationRequired(db, orderRef, attemptId, "provider_create_ambiguous");
    throw paymentOrderPendingError();
  }

  try {
    const acceptedId = await db.runTransaction(async (tx) => {
      const snap = await tx.get(orderRef);
      if (!snap.exists) return null;
      const current = snap.data()!;
      if (current.razorpayOrderId) return current.razorpayOrderId as string;
      if (current.rzpOrderAttemptId !== attemptId || current.rzpOrderCreationState !== "creating") return null;
      tx.update(orderRef, {
        razorpayOrderId: rz.id,
        rzpOrderCreationState: "ready",
        rzpOrderPendingAt: FieldValue.delete(),
        rzpOrderAttemptId: FieldValue.delete(),
      });
      return rz.id;
    });
    if (acceptedId !== rz.id) {
      await markPaymentOrderReconciliationRequired(db, orderRef, attemptId, "stale_provider_completion", rz.id);
      throw paymentOrderPendingError();
    }
    return { orderId: orderRef.id, razorpayOrderId: rz.id, amountPaise: totals.totalPaise, currency: CURRENCY, total: totals.totalPaise / 100 };
  } catch {
    // Provider success plus persistence failure is ambiguous. Preserve the reservation for reconciliation.
    await markPaymentOrderReconciliationRequired(db, orderRef, attemptId, "provider_succeeded_persistence_ambiguous", rz.id);
    throw paymentOrderPendingError();
  }
}

/**
 * Retry handling for the same request key. Without a provider idempotency key, an
 * absent ID is not proof that the first provider request failed. Never create again here.
 */
function paymentOrderPendingError(): OrderError {
  return new OrderError("failed-precondition", "Payment setup is pending reconciliation. Do not retry payment yet; please refresh your orders or contact support if this persists.");
}

/**
 * True only when Razorpay replied with an HTTP 4xx (the SDK rejects with `{ statusCode, error }`), meaning the order was NOT created.
 * Network failures, timeouts (the SDK then throws a plain TypeError/Error without a status), 5xx and 408 are ambiguous.
 */
export function isDefinitiveProviderRejection(err: unknown): boolean {
  const code = (err as { statusCode?: unknown } | null)?.statusCode;
  return typeof code === "number" && code >= 400 && code < 500 && code !== 408;
}

async function markPaymentOrderReconciliationRequired(
  db: Firestore,
  ref: FirebaseFirestore.DocumentReference,
  attemptId: string,
  reason: string,
  candidateProviderOrderId?: string,
): Promise<void> {
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const d = snap.data()!;
    if (d.razorpayOrderId || d.rzpOrderAttemptId !== attemptId) return;
    tx.update(ref, {
      rzpOrderCreationState: "reconciliation_required",
      rzpOrderReconciliationReason: reason,
      rzpOrderPendingAt: d.rzpOrderPendingAt || new Date().toISOString(),
      // Best effort: provider order known to exist. Operators match razorpayReceipt and notes.orderId.
      // Legacy orders may have used the full order id as receipt.
      ...(candidateProviderOrderId ? { rzpOrderCandidateId: candidateProviderOrderId } : {}),
    });
  }).catch(() => undefined);
}

async function resumeExistingOrder(
  db: Firestore, _rzp: RazorpayLike, ref: FirebaseFirestore.DocumentReference, first: FirebaseFirestore.DocumentData,
  expectedTotalPaise?: number, waitMs = PAYMENT_ORDER_WAIT_MS,
): Promise<CreatedOrder> {
  const processed = () => new OrderError("failed-precondition", "This order has already been processed. Please refresh and check your orders.");
  const ready = (d: FirebaseFirestore.DocumentData): CreatedOrder => ({
    orderId: ref.id, razorpayOrderId: d.razorpayOrderId as string, amountPaise: d.amountPaise,
    currency: d.currency, total: d.amountPaise / 100,
  });
  if (expectedTotalPaise !== undefined && expectedTotalPaise !== first.amountPaise) throw new OrderError("failed-precondition", PRICE_CHANGED_MESSAGE);
  if (first.status !== "pending" || first.paymentStatus !== "pending") throw processed();

  const deadline = Date.now() + waitMs;
  for (;;) {
    const snap = await ref.get();
    const d = snap.data();
    if (!snap.exists || !d || d.status !== "pending" || d.paymentStatus !== "pending") throw processed();
    if (d.razorpayOrderId) return ready(d);
    if (!d.rzpOrderCreationState) {
      await ref.update({
        rzpOrderCreationState: "reconciliation_required",
        rzpOrderReconciliationReason: "legacy_order_missing_provider_id",
      }).catch(() => undefined);
      throw paymentOrderPendingError();
    }
    if (d.rzpOrderCreationState === "reconciliation_required") throw paymentOrderPendingError();
    if (d.rzpOrderCreationState !== "creating" || Date.now() >= deadline) throw paymentOrderPendingError();
    await new Promise((r) => setTimeout(r, PAYMENT_ORDER_POLL_MS));
  }
}

/** An unknown provider outcome is never proof that stock can safely be released. */
function paymentSetupUnresolved(o: FirebaseFirestore.DocumentData): boolean {
  return o.status === "pending" && o.paymentStatus === "pending" &&
    (o.rzpOrderCreationState !== "ready" || typeof o.razorpayOrderId !== "string" || !o.razorpayOrderId);
}

/** Restores reserved stock exactly once and cancels an eligible order. Safe to call repeatedly. */
export async function releaseOrderStock(db: Firestore, orderId: string, reason: string, opts: { onlyIfUnpaid?: boolean } = {}): Promise<boolean> {
  return db.runTransaction(async (tx) => {
    const ref = db.collection("orders").doc(orderId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new OrderError("not-found", "Order not found.");
    const o = snap.data()!;
    if (reason === "cancelled_by_admin") {
      if (o.status === "cancelled") return false;
      // This check must share the stock-release transaction, including retries after a concurrent dispatch.
      if (["shipped", "delivered", "returned", "failed_delivery"].includes(o.status) || o.trackingId || o.dispatchDate) {
        throw new OrderError("failed-precondition", "A dispatched order cannot be cancelled here.");
      }
      if (paymentSetupUnresolved(o)) throw paymentOrderPendingError();
    }
    // Expiry must also re-check setup state transactionally: query results may be stale.
    if (reason === "payment_window_elapsed" && paymentSetupUnresolved(o)) return false;
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
    tx.update(ref, { stockReleased: true, status: "cancelled", statusReason: reason, cancelledAt: new Date().toISOString() });
    // a paid order that is cancelled must be refunded by staff (not automatic); the flag is staff-only, so it lives in orderInternal
    if (paid) tx.set(internalRef(db, orderId), { needsRefund: true, updatedAt: new Date().toISOString() }, { merge: true });
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
        tx.set(internalRef(db, orderRef.id), { duplicatePaymentIds: FieldValue.arrayUnion(input.payment.id), needsRefund: true, updatedAt: new Date().toISOString() }, { merge: true });
      }
      return { result: "already_paid" };
    }

    // The customer/admin deliberately cancelled this order: do NOT revive it. Record the payment and flag a refund.
    if (o.status === "cancelled" && (o.statusReason === "cancelled_by_customer" || o.statusReason === "cancelled_by_admin")) {
      const at = new Date().toISOString();
      tx.update(orderRef, {
        paymentStatus: "paid", razorpayPaymentId: input.payment.id, paidAt: at, paymentVerifiedAt: at,
        statusReason: "paid_after_cancellation",
      });
      tx.set(internalRef(db, orderRef.id), { needsRefund: true, updatedAt: at }, { merge: true });
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
      ...(stockOk ? {} : { statusReason: "paid_after_expiry_stock_unavailable" }),
    });
    if (!stockOk) tx.set(internalRef(db, orderRef.id), { needsRefund: true, updatedAt: paidAt }, { merge: true });
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
      tx.set(internalRef(db, orderRef.id), { lastPaymentError: input.reason ?? "payment_failed", lastFailedPaymentId: input.paymentId, updatedAt: new Date().toISOString() }, { merge: true });
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
  // Filter resolved, unpaid pending records before limit; reconciliation records must neither expire nor starve ready orders.
  const q = await db.collection("orders")
    .where("status", "==", "pending")
    .where("paymentStatus", "==", "pending")
    .where("rzpOrderCreationState", "==", "ready")
    .where("expiresAt", "<", now.toISOString())
    .orderBy("expiresAt", "asc")
    .limit(limit)
    .get();
  let released = 0;
  for (const d of q.docs) {
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
    // Unknown provider outcomes require operator reconciliation, even if the customer asks to cancel.
    if (paymentSetupUnresolved(o)) throw paymentOrderPendingError();
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
