/* eslint-disable */
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import Razorpay from "razorpay";

admin.initializeApp();

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || ""; 

export const createRazorpayOrder = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated to create a payment order."
    );
  }

  const data = request.data as any;
  const { amount, currency = "INR", receiptId } = data;

  if (!amount || typeof amount !== "number" || amount <= 0) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "A valid amount is required."
    );
  }

  try {
    const razorpay = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    });

    const options = {
      amount: Math.round(amount * 100),
      currency,
      receipt: receiptId || `rcpt_${request.auth.uid}_${Date.now()}`,
      payment_capture: 1,
    };

    const order = await razorpay.orders.create(options);

    if (receiptId) {
      await admin.firestore().collection("orders").doc(receiptId).update({
        razorpayOrderId: order.id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return {
      id: order.id,
      amount: order.amount,
      currency: order.currency,
    };
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    throw new functions.https.HttpsError("internal", "Unable to create Razorpay order");
  }
});

export const verifyRazorpayPayment = functions.https.onRequest(async (req, res) => {
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
    const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(req.body));
    const expectedSignature = crypto
      .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

    if (!crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature))) {
      res.status(400).send("Invalid signature.");
      return;
    }

    const event = req.body.event;
    const paymentEntity = req.body.payload.payment.entity;

    if (event === "payment.captured" || event === "order.paid") {
      const razorpayOrderId = paymentEntity.order_id;
      const paymentId = paymentEntity.id;

      // ⚡ SAFETY FIX: razorpayOrderId exist karna chahiye query se pehle
      if (!razorpayOrderId) {
        console.error("Critical: razorpayOrderId is missing in webhook payload.");
        res.status(400).send("Order ID missing.");
        return;
      }

      const ordersRef = admin.firestore().collection("orders");
      const snapshot = await ordersRef
        .where("razorpayOrderId", "==", razorpayOrderId)
        .limit(1)
        .get();

      if (snapshot.empty) {
        console.error(`Order mismatch: ${razorpayOrderId} not found.`);
        res.status(404).send("Order not found.");
        return;
      }

      const orderDoc = snapshot.docs[0];
      await orderDoc.ref.update({
        paymentStatus: "paid", 
        razorpayPaymentId: paymentId,
        paymentVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    res.status(200).json({ status: "ok" });
  } catch (error) {
    console.error("Fatal failure handling Razorpay webhook:", error);
    res.status(500).send("Internal Server Error.");
  }
});