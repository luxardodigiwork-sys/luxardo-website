import { addDoc, collection, doc, limit, onSnapshot, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { buildContactDoc, buildNewsletterDoc, buildWholesaleDoc, cooldownRemaining } from './enquiryDocs';

/** Where customers can reach us if the form cannot be submitted. */
export const SUPPORT_EMAIL = 'connect@luxardofashion.com';
export type EnquiryCollection = 'contactMessages' | 'wholesaleInquiries' | 'newsletterSubscribers';

export type SubmitResult = { ok: true } | { ok: false; error: string };
const FAIL = `We could not send this right now. Please email ${SUPPORT_EMAIL}.`;

function cooldown(kind: string, gapMs: number): string | null {
  const key = `LUXARDO_last_${kind}`;
  const left = cooldownRemaining(sessionStorage, key, Date.now(), gapMs);
  if (left > 0) return `Please wait ${Math.ceil(left / 1000)} seconds before sending again.`;
  return null;
}
const stamp = (kind: string) => { try { sessionStorage.setItem(`LUXARDO_last_${kind}`, String(Date.now())); } catch { /* ignore */ } };

export async function submitContact(raw: Record<string, unknown>): Promise<SubmitResult> {
  const wait = cooldown('contact', 15000);
  if (wait) return { ok: false, error: wait };
  const built = buildContactDoc(raw);
  if (built.ok === false) return { ok: false, error: built.error };
  try {
    await addDoc(collection(db, 'contactMessages'), built.data);
    stamp('contact');
    return { ok: true };
  } catch (e) {
    console.error('Contact submit failed:', e);
    return { ok: false, error: FAIL };
  }
}

export async function submitWholesale(raw: Record<string, unknown>): Promise<SubmitResult> {
  const wait = cooldown('wholesale', 30000);
  if (wait) return { ok: false, error: wait };
  const built = buildWholesaleDoc(raw);
  if (built.ok === false) return { ok: false, error: built.error };
  try {
    await addDoc(collection(db, 'wholesaleInquiries'), built.data);
    stamp('wholesale');
    return { ok: true };
  } catch (e) {
    console.error('Wholesale submit failed:', e);
    return { ok: false, error: FAIL };
  }
}

/** A repeat subscription is refused by the rules (create-only); that is reported as success without revealing it. */
export async function subscribeNewsletter(rawEmail: unknown): Promise<SubmitResult> {
  const wait = cooldown('newsletter', 5000);
  if (wait) return { ok: false, error: wait };
  const built = buildNewsletterDoc(rawEmail);
  if (built.ok === false) return { ok: false, error: built.error };
  try {
    await setDoc(doc(db, 'newsletterSubscribers', built.data.id), built.data.data);
    stamp('newsletter');
    return { ok: true };
  } catch (e: any) {
    if (e?.code === 'permission-denied') return { ok: true };
    console.error('Newsletter submit failed:', e);
    return { ok: false, error: FAIL };
  }
}

/** Admin: live list of enquiries, newest first. Returns the unsubscribe function. */
export function watchEnquiries(name: EnquiryCollection, onData: (rows: any[]) => void, onError: (e: unknown) => void): () => void {
  return onSnapshot(
    query(collection(db, name), orderBy('createdAt', 'desc'), limit(300)),
    (snap) => onData(snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
    onError,
  );
}

export async function setEnquiryStatus(name: EnquiryCollection, id: string, status: string): Promise<void> {
  await updateDoc(doc(db, name, id), { status, updatedAt: new Date().toISOString() });
}
