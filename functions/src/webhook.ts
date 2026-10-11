/** Razorpay webhook processing, kept free of the Functions runtime so it can be tested against the emulator. */
import type { Firestore } from "firebase-admin/firestore";
import { OrderError, verifyWebhookSignature } from "./core";
import { applyCapturedPayment, recordPaymentFailure } from "./orders";

export interface WebhookInput {
  rawBody: Buffer | undefined;
  signature: string | string[] | undefined;
  eventId: string | string[] | undefined;
  body: any;
  secret: string;
  ownerNotifyEmail?: string;
}
export interface WebhookResponse { status: number; body: unknown }

export async function processWebhook(db: Firestore, input: WebhookInput): Promise<WebhookResponse> {
  const { rawBody, eventId } = input;
  if (!rawBody || typeof eventId !== "string" || !eventId) return { status: 400, body: "Bad request" };
  if (!verifyWebhookSignature(rawBody, input.signature as any, input.secret)) return { status: 400, body: "Invalid signature" };
  try {
    const event = input.body?.event as string;
    const payment = input.body?.payload?.payment?.entity;
    if ((event === "payment.captured" || event === "order.paid") && payment) {
      const entity = event === "order.paid" ? { ...payment, status: "captured" } : payment;
      const result = await applyCapturedPayment(db, { razorpayOrderId: payment.order_id, payment: entity, eventId, ownerNotifyEmail: input.ownerNotifyEmail });
      return { status: 200, body: { ok: true, result: result.result } };
    }
    if (event === "payment.failed" && payment?.order_id) {
      const result = await recordPaymentFailure(db, { razorpayOrderId: payment.order_id, paymentId: payment.id, reason: payment.error_code, eventId });
      return { status: 200, body: { ok: true, result } };
    }
    return { status: 200, body: { ok: true, ignored: event } };
  } catch (err) {
    if (err instanceof OrderError && (err.code === "not-found" || err.code === "permission-denied" || err.code === "failed-precondition")) {
      // Not retryable (unknown order / mismatched payment): acknowledge so Razorpay stops retrying; never marks paid.
      console.error("Webhook rejected:", err.code, err.message);
      return { status: 200, body: { ok: false, error: err.code } };
    }
    console.error("Webhook failure:", err);
    return { status: 500, body: "Internal Server Error" }; // retryable
  }
}
