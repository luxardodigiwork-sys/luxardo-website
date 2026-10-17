/**
 * Pure builders for visitor enquiries (contact form, wholesale form, newsletter). No Firebase import, so they are unit-tested.
 * Every document produced here must satisfy the matching firestore.rules block (same keys, same limits).
 */
export const ENQUIRY_LIMITS = { name: 100, email: 254, phone: 30, subject: 200, message: 3000, company: 200, short: 100, wholesaleName: 150, image: 260000 } as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (v: string) => v.length <= ENQUIRY_LIMITS.email && EMAIL.test(v);

/** Trims, caps the length and strips control characters (newlines kept only for multiline text). */
export function cleanText(v: unknown, max: number, multiline = false): string {
  const s = String(v ?? '');
  const stripped = multiline ? s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '') : s.replace(/[\u0000-\u001f\u007f]/g, ' ');
  return stripped.trim().slice(0, max);
}

export type Built<T> = { ok: true; data: T } | { ok: false; error: string };

export interface ContactDoc {
  firstName: string; lastName: string; email: string; phone: string; subject: string; message: string;
  status: 'pending'; createdAt: string; source: 'web';
}

export function buildContactDoc(raw: Record<string, unknown>, now = new Date()): Built<ContactDoc> {
  const email = cleanText(raw.email, ENQUIRY_LIMITS.email).toLowerCase();
  const message = cleanText(raw.message, ENQUIRY_LIMITS.message, true);
  if (!isEmail(email)) return { ok: false, error: 'Please enter a valid email address.' };
  if (!message) return { ok: false, error: 'Please write your message.' };
  return {
    ok: true,
    data: {
      firstName: cleanText(raw.firstName, ENQUIRY_LIMITS.name),
      lastName: cleanText(raw.lastName, ENQUIRY_LIMITS.name),
      email,
      phone: cleanText(raw.phone, ENQUIRY_LIMITS.phone),
      subject: cleanText(raw.subject, ENQUIRY_LIMITS.subject),
      message,
      status: 'pending',
      createdAt: now.toISOString(),
      source: 'web',
    },
  };
}

export interface WholesaleDoc {
  full_name: string; company_name: string; email: string; phone: string; country: string; city: string;
  retail_type: string; monthly_volume: string; message: string; image?: string; imageOmitted?: boolean;
  status: 'pending'; created_at: string; createdAt: string; source: 'web';
}

export function buildWholesaleDoc(raw: Record<string, unknown>, now = new Date()): Built<WholesaleDoc> {
  const email = cleanText(raw.email, ENQUIRY_LIMITS.email).toLowerCase();
  const fullName = cleanText(raw.full_name, ENQUIRY_LIMITS.wholesaleName);
  if (!fullName) return { ok: false, error: 'Please enter your name.' };
  if (!isEmail(email)) return { ok: false, error: 'Please enter a valid email address.' };
  const iso = now.toISOString();
  const data: WholesaleDoc = {
    full_name: fullName,
    company_name: cleanText(raw.company_name, ENQUIRY_LIMITS.company),
    email,
    phone: cleanText(raw.phone, ENQUIRY_LIMITS.phone),
    country: cleanText(raw.country, ENQUIRY_LIMITS.short),
    city: cleanText(raw.city, ENQUIRY_LIMITS.short),
    retail_type: cleanText(raw.retail_type, ENQUIRY_LIMITS.short),
    monthly_volume: cleanText(raw.monthly_volume, ENQUIRY_LIMITS.short),
    message: cleanText(raw.message, ENQUIRY_LIMITS.message, true),
    status: 'pending',
    created_at: iso,
    createdAt: iso,
    source: 'web',
  };
  const img = typeof raw.image === 'string' ? raw.image : '';
  if (img) {
    // A small attached image is kept; a large one is dropped (documents are limited to 1 MB) and flagged.
    if (img.length <= ENQUIRY_LIMITS.image && /^data:image\/(png|jpe?g|webp);base64,/.test(img)) data.image = img;
    else data.imageOmitted = true;
  }
  return { ok: true, data };
}

export interface NewsletterDoc { email: string; createdAt: string; status: 'subscribed'; source: 'footer' }

/** The document id is the lower-case email, so one address can only subscribe once (a repeat is refused by the rules). */
export function buildNewsletterDoc(rawEmail: unknown, now = new Date()): Built<{ id: string; data: NewsletterDoc }> {
  const email = cleanText(rawEmail, ENQUIRY_LIMITS.email).toLowerCase();
  if (!isEmail(email) || email.includes('/')) return { ok: false, error: 'Please enter a valid email address.' };
  return { ok: true, data: { id: email, data: { email, createdAt: now.toISOString(), status: 'subscribed', source: 'footer' } } };
}

/** Simple client-side cooldown so one browser cannot flood a form. `store` is sessionStorage-like. */
export function cooldownRemaining(store: { getItem(k: string): string | null }, key: string, nowMs: number, gapMs: number): number {
  let last = 0;
  try { last = Number(store.getItem(key)) || 0; } catch { last = 0; }
  return Math.max(0, last + gapMs - nowMs);
}
