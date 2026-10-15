/**
 * Owner notification for website enquiries, with limits that never lose an enquiry.
 * The enquiry document itself is always kept (and visible in the admin panel). Only the owner's e-mail can be held back,
 * in which case the enquiry is marked `notifyState` = throttled | sender-limited and reported by the hourly digest.
 */
import { createHash } from "node:crypto";
import { EnquiryKind, buildDigestEmail, buildEnquiryMailDoc, nextThrottle, DigestFailure, DigestItem } from "./enquiries";
import { MAIL_COLLECTION } from "./emails";

export const GLOBAL_MAX_PER_HOUR = 20;
export const SENDER_MAX_PER_HOUR = 3;
const COLLECTION: Record<EnquiryKind, string> = { contact: "contactMessages", wholesale: "wholesaleInquiries" };

export type NotifyOutcome = "queued" | "duplicate" | "no-owner" | "throttled" | "sender-limited";

const senderKey = (email: unknown) =>
  createHash("sha256").update(String(email ?? "").trim().toLowerCase() || "anonymous").digest("hex").slice(0, 32);

/** Transactional: at most one owner mail per enquiry (deterministic id), SENDER_MAX_PER_HOUR per sender, GLOBAL_MAX_PER_HOUR overall. */
export async function queueEnquiryMail(
  db: FirebaseFirestore.Firestore, kind: EnquiryKind, id: string, data: Record<string, unknown>, ownerEmail: string | undefined, nowMs = Date.now(),
): Promise<NotifyOutcome> {
  const mail = buildEnquiryMailDoc(kind, id, data, ownerEmail);
  if (!mail) return "no-owner";
  const enquiryRef = db.collection(COLLECTION[kind]).doc(id);
  const globalRef = db.collection("meta").doc("enquiryEmailThrottle");
  const senderRef = db.collection("enquiryLimits").doc(senderKey(data.email));
  const mailRef = db.collection(MAIL_COLLECTION).doc(mail.id);
  const stamp = new Date(nowMs).toISOString();
  return db.runTransaction(async (tx) => {
    const [g, s, m] = await Promise.all([tx.get(globalRef), tx.get(senderRef), tx.get(mailRef)]);
    if (m.exists) return "duplicate" as NotifyOutcome; // a retried trigger must not consume the limits twice
    const sender = nextThrottle(s.data() as Record<string, number> | undefined, nowMs, SENDER_MAX_PER_HOUR);
    if (!sender.allowed) {
      tx.update(enquiryRef, { notifyState: "sender-limited", notifyAt: stamp });
      return "sender-limited" as NotifyOutcome;
    }
    const global = nextThrottle(g.data() as Record<string, number> | undefined, nowMs, GLOBAL_MAX_PER_HOUR);
    if (!global.allowed) {
      tx.update(enquiryRef, { notifyState: "throttled", notifyAt: stamp });
      return "throttled" as NotifyOutcome;
    }
    tx.set(senderRef, sender.state);
    tx.set(globalRef, global.state);
    tx.set(mailRef, { ...mail.data, queuedAt: stamp });
    tx.update(enquiryRef, { notifyState: "queued", notifyAt: stamp });
    return "queued" as NotifyOutcome;
  });
}

/** Hourly: one summary mail (deterministic id per hour, bypasses the limits) for held-back enquiries and failed enquiry mails. */
export async function sendEnquiryDigest(
  db: FirebaseFirestore.Firestore, ownerEmail: string | undefined, nowMs = Date.now(),
): Promise<{ sent: boolean; held: number; failed: number }> {
  const items: Array<DigestItem & { ref: FirebaseFirestore.DocumentReference }> = [];
  for (const kind of Object.keys(COLLECTION) as EnquiryKind[]) {
    const snap = await db.collection(COLLECTION[kind]).where("notifyState", "in", ["throttled", "sender-limited"]).limit(100).get();
    for (const d of snap.docs) {
      const x = d.data();
      items.push({ kind, id: d.id, name: String(x.full_name ?? `${x.firstName ?? ""} ${x.lastName ?? ""}`).trim() || "Website visitor", email: String(x.email ?? ""), reason: x.notifyState, ref: d.ref });
    }
  }
  const failSnap = await db.collection(MAIL_COLLECTION).where("delivery.state", "==", "ERROR").limit(50).get();
  const failed = failSnap.docs.filter((d) => d.data().kind === "enquiry" && !d.data().digestedAt);
  if (!items.length && !failed.length) return { sent: false, held: 0, failed: 0 };
  if (!ownerEmail) return { sent: false, held: items.length, failed: failed.length }; // still visible in the admin panel
  const failures: DigestFailure[] = failed.map((d) => ({ mailId: d.id, error: String(d.data().delivery?.error ?? "unknown") }));
  const mail = buildEnquiryMailDoc("contact", "x", { email: "" }, ownerEmail)!; // validates the owner address and gives the shape
  const doc = { to: mail.data.to, message: buildDigestEmail(items, failures), kind: "enquiry-digest", queuedAt: new Date(nowMs).toISOString() };
  try {
    await db.collection(MAIL_COLLECTION).doc(`enquiry-digest-${Math.floor(nowMs / 3_600_000)}`).create(doc);
  } catch (e) {
    if ((e as { code?: number }).code === 6) return { sent: false, held: items.length, failed: failed.length }; // this hour's digest exists; retry next hour
    throw e;
  }
  const batch = db.batch();
  for (const i of items) batch.update(i.ref, { notifyState: "digested", notifyAt: new Date(nowMs).toISOString() });
  for (const f of failed) batch.update(f.ref, { digestedAt: new Date(nowMs).toISOString() });
  await batch.commit();
  return { sent: true, held: items.length, failed: failed.length };
}
