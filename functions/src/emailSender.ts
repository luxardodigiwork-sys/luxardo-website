import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { Resend } from "resend";

const resendApiKey = defineSecret("RESEND_API_KEY");

const FROM_EMAIL = "LUXARDO FASHION <orders@luxardofashion.com>";
const ADMIN_EMAIL = "connect@luxardofashion.com";
const BRAND_NAME = "LUXARDO FASHION";
const SITE_URL = "https://luxardofashion.com";
const SUPPORT_WHATSAPP = "+91 96640 40699";

function formatINR(amount: number): string {
  return "INR " + Number(amount || 0).toLocaleString("en-IN");
}

function customerOrderHtml(order: any): string {
  const items = (order.items || []).map((it: any) =>
    "<tr><td style=\"padding:8px;border-bottom:1px solid #eee\">" +
    (it.name || "Product") +
    "</td><td style=\"padding:8px;border-bottom:1px solid #eee;text-align:right\">" +
    formatINR(it.price * (it.quantity || 1)) +
    "</td></tr>"
  ).join("");

  return "<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head><body style=\"font-family:Georgia,serif;background:#f8f8f5;margin:0;padding:0\">" +
    "<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#000;padding:40px 0;text-align:center\">" +
    "<tr><td><h1 style=\"color:#fff;letter-spacing:6px;font-size:32px;margin:0\">" + BRAND_NAME + "</h1>" +
    "<p style=\"color:#999;letter-spacing:3px;font-size:12px;margin:5px 0 0\">ITALY</p></td></tr></table>" +
    "<table width=\"600\" align=\"center\" style=\"background:#fff;margin:30px auto;padding:40px;max-width:600px\"><tr><td>" +
    "<h2 style=\"font-weight:300;color:#000\">Thank you for your order!</h2>" +
    "<p style=\"color:#555\">Hi " + (order.userName || "Valued Customer") + ",</p>" +
    "<p style=\"color:#555;line-height:1.6\">We have received your order and are preparing it with care. You will receive a shipping confirmation email shortly.</p>" +
    "<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:20px 0;border-top:2px solid #000;padding-top:20px\">" +
    "<tr><td style=\"color:#666;font-size:12px;text-transform:uppercase;letter-spacing:2px\">Order ID</td><td style=\"text-align:right;color:#000;font-weight:bold\">" + (order.id || "ORD-XXXX") + "</td></tr>" +
    "<tr><td style=\"color:#666;font-size:12px;text-transform:uppercase;letter-spacing:2px\">Payment</td><td style=\"text-align:right;color:#000\">" + (order.paymentMethod || "Cash on Delivery") + "</td></tr>" +
    "<tr><td style=\"color:#666;font-size:12px;text-transform:uppercase;letter-spacing:2px\">Status</td><td style=\"text-align:right;color:#000\">" + (order.status || "Pending") + "</td></tr>" +
    "</table>" +
    "<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:20px 0\">" +
    "<thead><tr><th style=\"text-align:left;padding:8px;border-bottom:2px solid #000;text-transform:uppercase;font-size:11px;letter-spacing:2px\">Item</th>" +
    "<th style=\"text-align:right;padding:8px;border-bottom:2px solid #000;text-transform:uppercase;font-size:11px;letter-spacing:2px\">Amount</th></tr></thead>" +
    "<tbody>" + items + "</tbody>" +
    "<tfoot><tr><td style=\"padding:12px 8px;font-weight:bold;font-size:16px\">Total</td>" +
    "<td style=\"padding:12px 8px;text-align:right;font-weight:bold;font-size:16px\">" + formatINR(order.totalAmount || 0) + "</td></tr></tfoot>" +
    "</table>" +
    "<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#f8f8f5;padding:20px;margin:20px 0\"><tr><td>" +
    "<p style=\"margin:0 0 10px;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:2px\">Delivery Address</p>" +
    "<p style=\"margin:0;color:#000;line-height:1.6\">" + ((order.address && order.address.fullName) || order.userName || "") + "<br>" +
    ((order.address && order.address.line1) || "") + "<br>" +
    ((order.address && order.address.city) || "") + ", " + ((order.address && order.address.state) || "") + " " + ((order.address && order.address.postalCode) || "") +
    "</p></td></tr></table>" +
    "<p style=\"text-align:center;margin:30px 0\">" +
    "<a href=\"" + SITE_URL + "/track-order/" + (order.id || "") + "\" style=\"display:inline-block;background:#000;color:#fff;padding:14px 32px;text-decoration:none;letter-spacing:3px;font-size:12px;text-transform:uppercase\">Track Order</a></p>" +
    "<p style=\"color:#999;font-size:12px;text-align:center;margin-top:30px\">Questions? WhatsApp us at " + SUPPORT_WHATSAPP + "</p>" +
    "</td></tr></table></body></html>";
}

function adminAlertHtml(order: any): string {
  return "<!DOCTYPE html><html><body style=\"font-family:Arial,sans-serif;background:#fff\">" +
    "<h2>New Order Received</h2>" +
    "<p><strong>Order ID:</strong> " + (order.id || "ORD-XXXX") + "</p>" +
    "<p><strong>Customer:</strong> " + (order.userName || "N/A") + " (" + (order.userEmail || "N/A") + ")</p>" +
    "<p><strong>Phone:</strong> " + ((order.address && order.address.phone) || "N/A") + "</p>" +
    "<p><strong>Total:</strong> " + formatINR(order.totalAmount || 0) + "</p>" +
    "<p><strong>Payment:</strong> " + (order.paymentMethod || "COD") + "</p>" +
    "<p><strong>Status:</strong> " + (order.status || "pending") + "</p>" +
    "<p><strong>Address:</strong> " + ((order.address && order.address.line1) || "") + ", " +
    ((order.address && order.address.city) || "") + ", " + ((order.address && order.address.postalCode) || "") + "</p>" +
    "<p>Action: <a href=\"" + SITE_URL + "/admin/dispatch\">/admin/dispatch</a></p>" +
    "</body></html>";
}

export const sendOrderEmail = onDocumentCreated(
  {
    document: "orders/{orderId}",
    secrets: [resendApiKey],
    region: "us-central1",
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const order: any = { id: event.params.orderId, ...snap.data() };
    
    const resend = new Resend(resendApiKey.value());
    
    try {
      if (order.userEmail) {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: order.userEmail,
          subject: "Order Confirmed - " + BRAND_NAME + " #" + order.id,
          html: customerOrderHtml(order),
        });
        console.log("Customer email sent to", order.userEmail);
      }
      
      await resend.emails.send({
        from: FROM_EMAIL,
        to: ADMIN_EMAIL,
        subject: "New Order " + order.id + " - " + formatINR(order.totalAmount || 0),
        html: adminAlertHtml(order),
      });
      console.log("Admin alert sent to", ADMIN_EMAIL);
    } catch (err) {
      console.error("Email send error:", err);
    }
  }
);
