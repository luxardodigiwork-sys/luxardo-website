/* eslint-disable */
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { setGlobalOptions } from "firebase-functions/v2";
import * as admin from "firebase-admin";
import * as crypto from "crypto";

admin.initializeApp();

setGlobalOptions({ region: "us-central1", maxInstances: 10 });

// Razorpay secrets (set via: firebase functions:secrets:set RAZORPAY_KEY_SECRET)
const RAZORPAY_WEBHOOK_SECRET = defineSecret("RAZORPAY_WEBHOOK_SECRET");

// Server-authoritative checkout (prices from Firestore, orders created
// server-side, paid only after signature verification) — see checkout.ts.
export { createRazorpayOrder, verifyRazorpayPayment, createCodOrder } from "./checkout";
import { markOrderPaid } from "./checkout";
import { resendApiKey } from "./emailSender";

/* ──────────────────────────────────────────────────────────────
 * razorpayWebhook (HTTP)
 * Configure URL in Razorpay Dashboard > Settings > Webhooks
 * Updates Firestore order on payment.captured / order.paid
 * ─────────────────────────────────────────────────────────────*/
export const razorpayWebhook = onRequest(
  { secrets: [RAZORPAY_WEBHOOK_SECRET, resendApiKey] },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const signature = req.headers["x-razorpay-signature"];
    if (!signature || typeof signature !== "string") {
      res.status(401).send("Missing signature.");
      return;
    }

    try {
      const webhookSecret = RAZORPAY_WEBHOOK_SECRET.value();
      const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(req.body));
      const expectedSignature = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");

      const ok = expectedSignature.length === signature.length &&
        crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
      if (!ok) {
        res.status(400).send("Invalid signature.");
        return;
      }

      const event = req.body.event;
      const paymentEntity = req.body.payload?.payment?.entity;

      if ((event === "payment.captured" || event === "order.paid") && paymentEntity) {
        const razorpayOrderId = paymentEntity.order_id;
        const paymentId = paymentEntity.id;

        if (!razorpayOrderId) {
          res.status(400).send("Order ID missing.");
          return;
        }

        const snapshot = await admin.firestore()
          .collection("orders")
          .where("razorpay.orderId", "==", razorpayOrderId)
          .limit(1)
          .get();

        if (snapshot.empty) {
          console.warn(`Webhook: order with razorpay.orderId=${razorpayOrderId} not found`);
          res.status(200).json({ status: "ignored" });
          return;
        }

        // Confirms the order even if the customer's browser closed after
        // paying. Idempotent with verifyRazorpayPayment (paid once only).
        await markOrderPaid(snapshot.docs[0].ref, razorpayOrderId, paymentId, "webhook");
      }

      res.status(200).json({ status: "ok" });
    } catch (error) {
      console.error("Razorpay webhook failure:", error);
      res.status(500).send("Internal Server Error.");
    }
  }
);

// Email notifications (Day 3 — existing)
export { sendOrderEmail } from "./emailSender";

// Staff accounts for the e-commerce back office (Owner / Dispatch / Accounts /
// Analysis portals). LUXARDO FLOW production callables (designs, PRs, pieces,
// labour, QC, tailor, store, karigars) now live ONLY in the separate
// luxardo-flow repo and Firebase project.
export { nextId, staffCreate, staffUpdate, staffChangePassword, userProfileSelfUpdate, mobileResetLookup, mobileResetSendOtp } from "./production";
