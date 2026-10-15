import type { User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { staffRoleFromClaims, StaffRole } from './staffRole';

/** Server-enforced: adminCheck is readable only when firestore.rules isAdmin() is true. */
export async function probeIsAdmin(): Promise<boolean> {
  try {
    await getDoc(doc(db, 'adminCheck', 'probe'));
    return true;
  } catch {
    return false;
  }
}

/** Resolves the staff role of a signed-in account (null = not staff). Forces a fresh token so new claims apply. */
export async function resolveStaffRole(user: FirebaseUser, forceRefresh = false): Promise<StaffRole | null> {
  if (user.isAnonymous) return null;
  let claims: Record<string, unknown> | undefined;
  try {
    claims = (await user.getIdTokenResult(forceRefresh)).claims as Record<string, unknown>;
  } catch {
    claims = undefined;
  }
  const fromClaims = staffRoleFromClaims(claims, false);
  if (fromClaims) return fromClaims;
  return (await probeIsAdmin()) ? 'admin' : null;
}
