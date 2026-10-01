/**
 * Lazy Login for Enquiry pattern:
 *   1. User fills an enquiry form (contact/wholesale/bespoke).
 *   2. If NOT logged in -> save draft to sessionStorage + redirect to /login.
 *   3. After successful login, page that owns the form reads the draft,
 *      auto-submits it, then clears the draft.
 *
 * Each "kind" of form has its own draft key so multiple drafts can coexist.
 */

export type EnquiryKind =
  | 'contact'
  | 'wholesale'
  | 'bespoke'
  | 'style-consultation'
  | 'newsletter';

const KEY_PREFIX = 'LUXARDO_ENQUIRY_DRAFT_';

export function saveEnquiryDraft<T = any>(kind: EnquiryKind, data: T) {
  try {
    sessionStorage.setItem(KEY_PREFIX + kind, JSON.stringify({
      kind,
      data,
      savedAt: new Date().toISOString(),
    }));
  } catch (e) {
    console.warn('[lazyEnquiry] save failed:', e);
  }
}

export function readEnquiryDraft<T = any>(kind: EnquiryKind): T | null {
  try {
    const raw = sessionStorage.getItem(KEY_PREFIX + kind);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.data as T;
  } catch {
    return null;
  }
}

export function clearEnquiryDraft(kind: EnquiryKind) {
  try {
    sessionStorage.removeItem(KEY_PREFIX + kind);
  } catch {}
}

/**
 * Returns true if there is a pending draft of this kind.
 */
export function hasEnquiryDraft(kind: EnquiryKind): boolean {
  try {
    return sessionStorage.getItem(KEY_PREFIX + kind) !== null;
  } catch {
    return false;
  }
}
