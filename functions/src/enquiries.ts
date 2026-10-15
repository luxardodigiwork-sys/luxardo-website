/** Owner notification for website enquiries (contact + wholesale). Pure logic; the Firestore trigger lives in index.ts. */
import { esc, MAIL_COLLECTION } from "./emails";

export type EnquiryKind = "contact" | "wholesale";
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
const oneLine = (v: unknown, max: number) => String(v ?? "").replace(/[\r\n\t]+/g, " ").trim().slice(0, max);
const para = (v: unknown, max: number) => esc(String(v ?? "").slice(0, max)).replace(/\r?\n/g, "<br>");

export function buildEnquiryEmail(kind: EnquiryKind, id: string, d: Record<string, unknown>): { subject: string; html: string; text: string } {
  if (kind === "contact") {
    const name = oneLine(`${d.firstName ?? ""} ${d.lastName ?? ""}`, 200) || "Website visitor";
    const subject = oneLine(d.subject, 120) || "(no subject)";
    return {
      subject: `Website message: ${subject}`,
      html: `<p><strong>New message from the website Contact form</strong> (ref ${esc(id)})</p>
<p>From: ${esc(name)} &lt;${esc(oneLine(d.email, 254))}&gt;<br>Phone: ${esc(oneLine(d.phone, 30))}<br>Subject: ${esc(subject)}</p>
<p>${para(d.message, 3000)}</p><p>Reply to this email to answer the customer.</p>`,
      text: `New website message (ref ${id})\nFrom: ${name} <${oneLine(d.email, 254)}> ${oneLine(d.phone, 30)}\nSubject: ${subject}\n\n${String(d.message ?? "").slice(0, 3000)}`,
    };
  }
  const name = oneLine(d.full_name, 150) || "Website visitor";
  const company = oneLine(d.company_name, 200);
  return {
    subject: `Wholesale enquiry: ${name}${company ? ` (${company})` : ""}`,
    html: `<p><strong>New wholesale enquiry</strong> (ref ${esc(id)})</p>
<p>${esc(name)}${company ? `, ${esc(company)}` : ""} &lt;${esc(oneLine(d.email, 254))}&gt;<br>Phone: ${esc(oneLine(d.phone, 30))}<br>
Location: ${esc(oneLine(d.city, 100))}, ${esc(oneLine(d.country, 100))}<br>Type: ${esc(oneLine(d.retail_type, 100))} | Monthly volume: ${esc(oneLine(d.monthly_volume, 100))}</p>
<p>${para(d.message, 3000)}</p><p>Reply to this email to answer.</p>`,
    text: `New wholesale enquiry (ref ${id})\n${name} ${company} <${oneLine(d.email, 254)}> ${oneLine(d.phone, 30)}\n${oneLine(d.city, 100)}, ${oneLine(d.country, 100)}\nType: ${oneLine(d.retail_type, 100)} | Volume: ${oneLine(d.monthly_volume, 100)}\n\n${String(d.message ?? "").slice(0, 3000)}`,
  };
}

export interface EnquiryMailDoc { id: string; data: { to: string; replyTo?: string; message: { subject: string; html: string; text: string }; kind: "enquiry" } }

/** Deterministic id => at most one owner mail per enquiry. Returns null when no valid owner address is configured. */
export function buildEnquiryMailDoc(kind: EnquiryKind, id: string, d: Record<string, unknown>, ownerEmail: string | undefined): EnquiryMailDoc | null {
  if (!ownerEmail || !EMAIL_RE.test(ownerEmail)) return null;
  const replyTo = typeof d.email === "string" && EMAIL_RE.test(d.email) ? d.email : undefined;
  return { id: `enquiry-${kind}-${id}`, data: { to: ownerEmail, ...(replyTo ? { replyTo } : {}), message: buildEnquiryEmail(kind, id, d), kind: "enquiry" } };
}

export interface ThrottleState { windowStart: number; count: number }

/** At most `max` owner mails per window, so a spammer cannot flood the owner's inbox or the Resend quota. */
export function nextThrottle(prev: Partial<ThrottleState> | undefined, nowMs: number, max = 20, windowMs = 3_600_000): { allowed: boolean; state: ThrottleState } {
  const fresh = !prev || typeof prev.windowStart !== "number" || nowMs - prev.windowStart >= windowMs || nowMs < prev.windowStart;
  const state: ThrottleState = fresh ? { windowStart: nowMs, count: 0 } : { windowStart: prev!.windowStart as number, count: Number(prev!.count) || 0 };
  if (state.count >= max) return { allowed: false, state };
  return { allowed: true, state: { ...state, count: state.count + 1 } };
}

export { MAIL_COLLECTION };

export interface DigestItem { kind: EnquiryKind; id: string; name: string; email: string; reason: "throttled" | "sender-limited" }
export interface DigestFailure { mailId: string; error: string }

/** One summary mail for enquiries whose own owner-mail was held back (limits) or failed. Content is escaped; nothing is dropped. */
export function buildDigestEmail(items: DigestItem[], failures: DigestFailure[]): { subject: string; html: string; text: string } {
  const rows = items.map((i) => `<li>${esc(i.kind)} ${esc(i.id)} - ${esc(oneLine(i.name, 100))} &lt;${esc(oneLine(i.email, 254))}&gt; (${esc(i.reason)})</li>`).join("");
  const bad = failures.map((f) => `<li>${esc(f.mailId)}: ${esc(oneLine(f.error, 160))}</li>`).join("");
  const subject = `Website enquiries need attention (${items.length} held back, ${failures.length} failed)`;
  return {
    subject,
    html: `<p>These website enquiries were saved but their individual e-mail was not sent. Open Admin -> Contact Messages / Partners to read them.</p>`
      + (rows ? `<p><strong>Held back by e-mail limits</strong></p><ul>${rows}</ul>` : "")
      + (bad ? `<p><strong>E-mail delivery failed</strong></p><ul>${bad}</ul>` : ""),
    text: `Website enquiries need attention.\n${items.map((i) => `- ${i.kind} ${i.id} ${oneLine(i.name, 100)} <${oneLine(i.email, 254)}> (${i.reason})`).join("\n")}\n${failures.map((f) => `- FAILED ${f.mailId}: ${oneLine(f.error, 160)}`).join("\n")}`,
  };
}
