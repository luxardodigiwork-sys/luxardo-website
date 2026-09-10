import { HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

const db = admin.firestore();

export interface StaffIdentity {
  uid: string;
  role: string;
  name: string;
}

/**
 * Resolve the acting staff identity for a signed-in user (Phase 2).
 *
 * Checks staff/{uid} first (the Loom production identity doc — role =
 * owner | admin | designer | pm | dispatch | guard | tailor | store).
 * Falls back to customers/{uid} for admin / super_admin / owner accounts
 * that do not have a staff doc (e.g. the master admin).
 */
export async function requireStaff(uid: string): Promise<StaffIdentity> {
  const staffSnap = await db.doc(`staff/${uid}`).get();
  if (staffSnap.exists) {
    const d = staffSnap.data();
    return {
      uid,
      role: String(d?.role || ""),
      name: String(d?.displayName || ""),
    };
  }
  const custSnap = await db.doc(`customers/${uid}`).get();
  if (custSnap.exists) {
    const d = custSnap.data();
    const role = String(d?.role || "").toLowerCase();
    if (["admin", "super_admin", "owner"].includes(role)) {
      const name = d?.firstName
        ? `${d.firstName} ${d.lastName || ""}`.trim()
        : String(d?.name || "");
      return { uid, role, name };
    }
  }
  throw new HttpsError("permission-denied", "Production staff access required.");
}

/**
 * True when the actor identity satisfies one of the given roles.
 *
 * `super_admin` is a privileged SUPERSET of `admin` for production
 * authorization: any allow-list that grants `admin` also grants
 * `super_admin`. This is the only elevation — `super_admin` never gains an
 * operation that `admin` would not, and lists that exclude `admin`
 * (e.g. the guard-only QC list) still exclude `super_admin`. Role semantics
 * for owner/pm/guard/designer/dispatch/tailor/store are unchanged.
 *
 * This never relaxes authentication: the caller must already hold a valid
 * staff identity resolved by requireStaff() (which itself fails closed when
 * no staff/{uid} identity exists).
 */
export function hasAnyRole(identity: StaffIdentity, roles: string[]): boolean {
  const r = (identity.role || "").toLowerCase();
  if (roles.includes(r)) return true;
  if (r === "super_admin" && roles.includes("admin")) return true;
  return false;
}