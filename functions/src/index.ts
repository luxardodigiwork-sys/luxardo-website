/**
 * Luxardo Fashion payment backend (Firebase Functions v2).
 *
 * Secrets (set with `firebase functions:secrets:set`, never in code):
 *   RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET
 * Params (set at deploy time / .env.<project>, not secret):
 *   RAZORPAY_KEY_ID  - public key id (rzp_test_... / rzp_live_...)
 *   ADMIN_UIDS       - comma separated Firebase UIDs allowed to call admin functions
 *
 * Do NOT deploy until the Firebase project, Razorpay test-mode run and webhook are verified.
 */
import * as admin from "firebase-admin";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { processWebhook } from "./webhook";
import { sendViaResend } from "./resend";
import { StaffRoleError, applyStaffRole } from "./staffRoles";
import { EnquiryKind, buildEnquiryMailDoc, nextThrottle } from "./enquiries";
import { MAIL_COLLECTION } from "./emails";
import { defineSecret, defineString } from "firebase-functions/params";
import Razorpay from "razorpay";
import {
  OrderError, assertPhoneAuth, validateShippingAddress, verifyPaymentSignature,
} from "./core";
import {
  RazorpayLike, createCheckoutOrder, releaseExpiredOrders,
  releaseOrderStock, requestCancellation, requestReturn, verifyAndApplyPayment,
} from "./orders";

admin.initializeApp();
const db = admin.firestore();

/** Keep in sync with the client (`src/firebase.ts` -> getFunctions(app, REGION)). */
export const REGION = "asia-south1";

const RAZORPAY_KEY_ID = defineString("RAZORPAY_KEY_ID");
const RAZORPAY_KEY_SECRET = defineSecret("RAZORPAY_KEY_SECRET");
const RAZORPAY_WEBHOOK_SECRET = defineSecret("RAZORPAY_WEBHOOK_SECRET");
const ADMIN_UIDS = defineString("ADMIN_UIDS", { default: "" });
// Resend: secret API key + the verified sender. onboarding@resend.dev only works for the account owner until a domain is verified.
const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
const MAIL_FROM = defineString("MAIL_FROM", { default: "Luxardo Fashion <onboarding@resend.dev>" });
// Optional: shop-owner address for new-paid-order notifications (queued in the `mail` collection).
const OWNER_NOTIFY_EMAIL = defineString("OWNER_NOTIFY_EMAIL", { default: "" });

const razorpayClient = (): RazorpayLike =>
  new Razorpay({ key_id: RAZORPAY_KEY_ID.value(), key_secret: RAZORPAY_KEY_SECRET.value() }) as unknown as RazorpayLike;

function toHttpsError(err: unknown): HttpsError {
  if (err instanceof HttpsError) return err;
  if (err instanceof OrderError) return new HttpsError(err.code === "already-exists" ? "already-exists" : err.code, err.message);
  console.error("Unexpected error:", err);
  return new HttpsError("internal", "Something went wrong. Please try again.");
}

/** Creates a server-priced, stock-reserved order + Razorpay order. Phone-authenticated users only. */
export const createCheckoutOrderFn = onCall({ region: REGION, secrets: [RAZORPAY_KEY_SECRET] }, async (request) => {
  try {
    const uid = assertPhoneAuth(request.auth as any);
    const address = validateShippingAddress(request.data?.address);
    const created = await createCheckoutOrder(db, razorpayClient(), {
      uid,
      phone: (request.auth!.token as any).phone_number,
      lines: request.data?.items, // ids/quantities/sizes only; prices are never read from the client
      address,
      requestId: request.data?.requestId,
      expectedTotalPaise: Number.isInteger(request.data?.expectedTotalPaise) && request.data.expectedTotalPaise > 0 ? request.data.expectedTotalPaise : undefined,
    });
    return {
      orderId: created.orderId,
      razorpayOrderId: created.razorpayOrderId,
      amount: created.amountPaise,
      currency: created.currency,
      keyId: RAZORPAY_KEY_ID.value(),
    };
  } catch (err) {
    throw toHttpsError(err);
  }
});

/** Called after Razorpay Checkout succeeds: verifies signature, confirms capture with Razorpay, marks paid. */
export const verifyPaymentFn = onCall({ region: REGION, secrets: [RAZORPAY_KEY_SECRET] }, async (request) => {
  try {
    const uid = assertPhoneAuth(request.auth as any);
    const { orderId, razorpay_order_id: rzOrderId, razorpay_payment_id: rzPaymentId, razorpay_signature: signature } = request.data ?? {};
    if (typeof orderId !== "string" || typeof rzOrderId !== "string" || typeof rzPaymentId !== "string") {
      throw new OrderError("invalid-argument", "Missing payment details.");
    }
    if (!verifyPaymentSignature(rzOrderId, rzPaymentId, signature, RAZORPAY_KEY_SECRET.value())) {
      throw new OrderError("permission-denied", "Payment signature is invalid.");
    }
    const snap = await db.collection("orders").doc(orderId).get();
    if (!snap.exists || snap.data()!.userId !== uid || snap.data()!.razorpayOrderId !== rzOrderId) {
      throw new OrderError("not-found", "Order not found.");
    }
    const res = await verifyAndApplyPayment(db, razorpayClient(), { uid, orderId, razorpayPaymentId: rzPaymentId, ownerNotifyEmail: OWNER_NOTIFY_EMAIL.value() || undefined });
    return { status: res.result };
  } catch (err) {
    throw toHttpsError(err);
  }
});

/** Razorpay webhook: signature-verified, idempotent (event id), amount/currency-checked. */
export const razorpayWebhook = onRequest({ region: REGION, secrets: [RAZORPAY_WEBHOOK_SECRET, RAZORPAY_KEY_SECRET] }, async (req, res) => {
  if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }
  const out = await processWebhook(db, {
    rawBody: (req as any).rawBody,
    signature: req.headers["x-razorpay-signature"],
    eventId: req.headers["x-razorpay-event-id"],
    body: req.body,
    secret: RAZORPAY_WEBHOOK_SECRET.value(),
    ownerNotifyEmail: OWNER_NOTIFY_EMAIL.value() || undefined,
  });
  if (typeof out.body === "string") res.status(out.status).send(out.body); else res.status(out.status).json(out.body);
});

/**
 * Customer cancellation: within 24h of placing the order, while it is still safe (unpaid, or paid and not yet packed).
 * Unpaid orders are cancelled immediately; paid orders only get a cancellation REQUEST that staff approve and refund.
 * No refund is issued automatically.
 */
export const requestCancellationFn = onCall({ region: REGION }, async (request) => {
  try {
    const uid = assertPhoneAuth(request.auth as any);
    const orderId = request.data?.orderId;
    if (typeof orderId !== "string" || !orderId) throw new OrderError("invalid-argument", "Missing order id.");
    return await requestCancellation(db, { uid, orderId, reason: request.data?.reason });
  } catch (err) {
    throw toHttpsError(err);
  }
});

/** Customer return request: within 7 days of delivery. Staff review; no refund is automatic. */
export const requestReturnFn = onCall({ region: REGION }, async (request) => {
  try {
    const uid = assertPhoneAuth(request.auth as any);
    const orderId = request.data?.orderId;
    if (typeof orderId !== "string" || !orderId) throw new OrderError("invalid-argument", "Missing order id.");
    return await requestReturn(db, { uid, orderId, reason: request.data?.reason });
  } catch (err) {
    throw toHttpsError(err);
  }
});

/** Releases stock for unpaid orders whose payment window elapsed. */
export const releaseExpiredOrdersFn = onSchedule({ region: REGION, schedule: "every 10 minutes" }, async () => {
  const n = await releaseExpiredOrders(db);
  if (n) console.log(`Released stock for ${n} expired order(s).`);
});

/** Admin: cancel an order that has not shipped and restore its stock (refunds are done in the Razorpay dashboard). */
export const cancelOrderFn = onCall({ region: REGION }, async (request) => {
  try {
    const uid = request.auth?.uid;
    const allowed = ADMIN_UIDS.value().split(",").map((s) => s.trim()).filter(Boolean);
    if (!uid || !(request.auth!.token.admin === true || allowed.includes(uid))) {
      throw new OrderError("permission-denied", "Admin only.");
    }
    const orderId = request.data?.orderId;
    if (typeof orderId !== "string" || !orderId) throw new OrderError("invalid-argument", "Missing order id.");
    const snap = await db.collection("orders").doc(orderId).get();
    if (!snap.exists) throw new OrderError("not-found", "Order not found.");
    const status = snap.data()!.status;
    if (["shipped", "delivered"].includes(status)) throw new OrderError("failed-precondition", "A shipped order cannot be cancelled here.");
    const restored = await releaseOrderStock(db, orderId, "cancelled_by_admin");
    return { restored };
  } catch (err) {
    throw toHttpsError(err);
  }
});

/** Admin: give or remove a staff role (admin | owner | dispatch | none). Roles are custom claims; super_admin/analysis do not exist. */
export const setStaffRoleFn = onCall({ region: REGION }, async (request) => {
  try {
    const caller = {
      uid: request.auth?.uid,
      token: request.auth?.token as unknown as Record<string, unknown> | undefined,
      allowedUids: ADMIN_UIDS.value().split(",").map((x) => x.trim()).filter(Boolean),
    };
    const result = await applyStaffRole(admin.auth(), caller, request.data);
    await db.collection("auditLogs").add({ action: "setStaffRole", by: caller.uid, target: result.uid, role: result.role, at: new Date().toISOString() });
    return result;
  } catch (err) {
    if (err instanceof StaffRoleError) throw new HttpsError(err.code, err.message);
    throw toHttpsError(err);
  }
});

/** Sends each queued `mail/{id}` document through Resend and records the outcome on the document. */
export const sendQueuedMailFn = onDocumentCreated({ document: "mail/{mailId}", region: REGION, secrets: [RESEND_API_KEY] }, async (event) => {
  const snap = event.data;
  if (!snap) return;
  const data = snap.data() as Record<string, unknown>;
  if (data.delivery) return; // already handled (e.g. by an extension)
  const result = await sendViaResend(fetch as never, RESEND_API_KEY.value(), MAIL_FROM.value(), event.params.mailId, data);
  await snap.ref.update({
    delivery: result.ok
      ? { state: "SUCCESS", provider: "resend", id: result.id, at: new Date().toISOString() }
      : { state: "ERROR", provider: "resend", error: result.error, at: new Date().toISOString() },
  });
});

/** Queues one owner e-mail per website enquiry (throttled). Delivered by sendQueuedMailFn through Resend. */
async function notifyOwnerOfEnquiry(kind: EnquiryKind, id: string, data: Record<string, unknown>): Promise<void> {
  const mail = buildEnquiryMailDoc(kind, id, data, OWNER_NOTIFY_EMAIL.value());
  if (!mail) return; // OWNER_NOTIFY_EMAIL not set: the enquiry is still visible in the admin panel
  const throttleRef = db.collection("meta").doc("enquiryEmailThrottle");
  const mailRef = db.collection(MAIL_COLLECTION).doc(mail.id);
  await db.runTransaction(async (tx) => {
    const [t, m] = await Promise.all([tx.get(throttleRef), tx.get(mailRef)]);
    if (m.exists) return;
    const r = nextThrottle(t.data() as Record<string, number> | undefined, Date.now());
    tx.set(throttleRef, r.state);
    if (r.allowed) tx.set(mailRef, { ...mail.data, queuedAt: new Date().toISOString() });
  });
}

export const onContactMessageFn = onDocumentCreated({ document: "contactMessages/{id}", region: REGION }, async (event) => {
  if (event.data) await notifyOwnerOfEnquiry("contact", event.params.id, event.data.data() as Record<string, unknown>);
});

export const onWholesaleInquiryFn = onDocumentCreated({ document: "wholesaleInquiries/{id}", region: REGION }, async (event) => {
  if (event.data) await notifyOwnerOfEnquiry("wholesale", event.params.id, event.data.data() as Record<string, unknown>);
});
