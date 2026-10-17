/**
 * Order e-mail content + queue documents for the Firebase "Trigger Email from Firestore" extension
 * (it sends whatever is written to the `mail` collection). Writing a document here is NOT the same as
 * delivery: nothing is delivered until the extension is installed with a real SMTP/SendGrid provider and
 * a verified sender. The bill is an itemised ORDER BILL, not a GST tax invoice (GST details unconfirmed).
 */

export const MAIL_COLLECTION = "mail";

export function esc(v: unknown): string {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const inr = (n: number) => `₹${(Math.round(n * 100) / 100).toLocaleString("en-IN", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;

export interface MailOrder {
  items?: Array<{ name?: string; title?: string; size?: string; quantity?: number; price?: number; subtotal?: number }>;
  subtotalAmount?: number; shippingAmount?: number; totalAmount?: number;
  userName?: string; userEmail?: string; userPhone?: string;
  shippingAddress?: Record<string, unknown>;
  razorpayPaymentId?: string | null;
  paidAt?: string;
}

function itemRows(o: MailOrder) {
  return (o.items ?? []).map((i) => ({
    name: String(i.name ?? i.title ?? "Item"), size: String(i.size ?? ""), qty: Number(i.quantity ?? 0),
    price: Number(i.price ?? 0), line: Number(i.subtotal ?? Number(i.price ?? 0) * Number(i.quantity ?? 0)),
  }));
}

function billHtml(orderId: string, o: MailOrder): string {
  const rows = itemRows(o).map((r) =>
    `<tr><td>${esc(r.name)}${r.size ? ` (${esc(r.size)})` : ""}</td><td align="right">${r.qty}</td><td align="right">${inr(r.price)}</td><td align="right">${inr(r.line)}</td></tr>`).join("");
  const a = (o.shippingAddress ?? {}) as Record<string, unknown>;
  const addr = [a.fullName, a.addressLine1, a.addressLine2, a.city, a.state, a.postalCode].filter(Boolean).map(esc).join(", ");
  return `<h2>Order ${esc(orderId)}</h2>
<table width="100%" cellpadding="6" style="border-collapse:collapse"><thead><tr><th align="left">Item</th><th align="right">Qty</th><th align="right">Price</th><th align="right">Amount</th></tr></thead><tbody>${rows}</tbody></table>
<p>Subtotal: ${inr(Number(o.subtotalAmount ?? 0))}<br>Shipping: ${Number(o.shippingAmount ?? 0) === 0 ? "Free" : inr(Number(o.shippingAmount))}<br><strong>Total paid: ${inr(Number(o.totalAmount ?? 0))}</strong></p>
<p>Payment reference: ${esc(o.razorpayPaymentId ?? "")}</p>
<p>Ship to: ${addr}</p>
<p>These are ready-to-stitch fabric pieces; stitching is not included. This is an order bill, not a GST tax invoice.</p>`;
}

export function buildCustomerEmail(orderId: string, o: MailOrder) {
  return {
    subject: `Luxardo Fashion - order ${orderId} confirmed`,
    html: `<p>Hello ${esc(o.userName ?? "")}, thank you for your order. We have received your payment.</p>${billHtml(orderId, o)}`,
    text: `Order ${orderId} confirmed. Total paid: ${inr(Number(o.totalAmount ?? 0))}. Items: ${itemRows(o).map((r) => `${r.name} x${r.qty}`).join(", ")}. Ready-to-stitch fabric; stitching not included.`,
  };
}

export function buildOwnerEmail(orderId: string, o: MailOrder) {
  return {
    subject: `New paid order ${orderId} - ${inr(Number(o.totalAmount ?? 0))}`,
    html: `<p>New paid order from ${esc(o.userName ?? "")} (${esc(o.userEmail ?? "")}, ${esc(o.userPhone ?? "")}).</p>${billHtml(orderId, o)}`,
    text: `New paid order ${orderId} from ${o.userName ?? ""}. Total ${inr(Number(o.totalAmount ?? 0))}.`,
  };
}

const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

/** Mail queue documents (deterministic ids => at most one per order even if payment is processed twice). */
export function buildMailDocs(orderId: string, o: MailOrder, ownerEmail?: string): Array<{ id: string; data: { to: string; message: { subject: string; html: string; text: string } } }> {
  const docs: Array<{ id: string; data: { to: string; message: { subject: string; html: string; text: string } } }> = [];
  if (o.userEmail && EMAIL_RE.test(o.userEmail)) docs.push({ id: `order-${orderId}-customer`, data: { to: o.userEmail, message: buildCustomerEmail(orderId, o) } });
  if (ownerEmail && EMAIL_RE.test(ownerEmail)) docs.push({ id: `order-${orderId}-owner`, data: { to: ownerEmail, message: buildOwnerEmail(orderId, o) } });
  return docs;
}
