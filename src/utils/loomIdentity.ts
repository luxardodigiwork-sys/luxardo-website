/**
 * LUXARDO LOOM — shared identity / host helpers.
 *
 * Kept deliberately tiny and dependency-free so it can be imported from the
 * AuthContext, the login pages and the production route guard without pulling
 * in the wider app graph.
 *
 * The canonical staff-role list MUST stay in sync with the server source of
 * truth in functions/src/staffAuth.ts (CANONICAL_STAFF_ROLES) and the
 * StaffRole union in src/types/production.ts.
 */

export const CANONICAL_STAFF_ROLES = [
  "owner",
  "admin",
  "designer",
  "pm",
  "dispatch",
  "guard",
  "tailor",
  "store",
  "accounts",
  "analysis",
] as const;

export type CanonicalStaffRole = (typeof CANONICAL_STAFF_ROLES)[number];

/**
 * Canonical form of a role string, or null when it is not a recognised
 * canonical staff role. Legacy / typo roles (e.g. "grade") return null and
 * therefore fail closed — they are repaired only by the server-side
 * staffBackfillCustomerDocs job, never guessed at in the client.
 */
export function normalizeStaffRole(role: unknown): CanonicalStaffRole | null {
  const r = String(role ?? "").toLowerCase().trim();
  return (CANONICAL_STAFF_ROLES as readonly string[]).includes(r)
    ? (r as CanonicalStaffRole)
    : null;
}

export function isCanonicalStaffRole(role: unknown): boolean {
  return normalizeStaffRole(role) !== null;
}

/**
 * True when this bundle IS the Loom build (`vite build --mode loom`). The
 * dist-loom/ output is deployed exclusively to the luxardo-flow project
 * (firebase.loom.json), so "loom build" always means "run the Loom app".
 * Checked in addition to the hostname so a `--mode loom` build is correct
 * even when served from localhost / a preview channel.
 */
export const IS_LOOM_BUILD: boolean =
  typeof import.meta !== "undefined" &&
  (import.meta as ImportMeta).env?.MODE === "loom";

/**
 * True when the app is the Loom production system — either the Loom build,
 * or served from the dedicated Loom project host
 * (luxardo-flow.web.app / luxardo-flow.firebaseapp.com). On the Loom app the
 * production system is the ONLY thing mounted; the B2C storefront is never
 * reachable. Mirrors the check in src/App.tsx (kept as a local const there so
 * the B2C entry file stays free of cross-imports).
 */
export function isLoomHost(): boolean {
  if (IS_LOOM_BUILD) return true;
  return (
    typeof window !== "undefined" &&
    /(^|\.)luxardo-flow\.(web\.app|firebaseapp\.com)$/.test(window.location.hostname)
  );
}

/**
 * The two PRIVILEGED LUXARDO FLOW identities. Both are backed by REAL Gmail
 * mailboxes, so both keep Google Sign-In, email/password login and genuine
 * Firebase password reset. They are recognised by their Firebase Auth
 * identifier (not by a Firestore role string), so they resolve with zero
 * dependency on staff/{uid} / customers/{uid} and stay off the common staff
 * login page. Keep these in sync with:
 *   - src/context/AuthContext.tsx
 *   - scripts/loom-reset-staff-passwords.cjs   (EXCLUDE list — never get USER123456)
 *
 * NOTE: verified against the live luxardo-flow Firebase Auth accounts.
 */
export const SUPER_ADMIN_EMAIL = "luxardodigiwork@gmail.com";
export const ADMIN_EMAIL = "abhijeetra799@gmail.com";

/** Back-compat alias. */
export const MASTER_ADMIN_EMAIL = SUPER_ADMIN_EMAIL;

function emailEquals(email: unknown, target: string): boolean {
  return (
    typeof email === "string" &&
    email.trim().toLowerCase() === target.toLowerCase()
  );
}

/** True when the email is the Super Admin identifier (case-insensitive). */
export function isSuperAdminEmail(email: unknown): boolean {
  return emailEquals(email, SUPER_ADMIN_EMAIL);
}

/** True when the email is the Admin identifier (case-insensitive). */
export function isAdminEmail(email: unknown): boolean {
  return emailEquals(email, ADMIN_EMAIL);
}

/** True for either privileged Gmail identity (Super Admin or Admin). */
export function isPrivilegedEmail(email: unknown): boolean {
  return isSuperAdminEmail(email) || isAdminEmail(email);
}

/**
 * The app role for a privileged email, or null. Super Admin → "super_admin",
 * Admin → "admin". Used by AuthContext to resolve identity without a Firestore
 * read, and by the privileged login page to authorise entry.
 */
export function privilegedRoleForEmail(email: unknown): "super_admin" | "admin" | null {
  if (isSuperAdminEmail(email)) return "super_admin";
  if (isAdminEmail(email)) return "admin";
  return null;
}

/**
 * True for any identity allowed into the production system: a canonical staff
 * role, or the elevated "super_admin" identity (which is deliberately NOT in
 * CANONICAL_STAFF_ROLES because it is never assignable to a staff/{uid} doc).
 */
export function isStaffRoleOrSuperAdmin(role: unknown): boolean {
  return role === "super_admin" || isCanonicalStaffRole(role);
}
