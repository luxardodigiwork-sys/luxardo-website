/**
 * Staff roles. They come ONLY from Firebase custom claims (set server-side by setStaffRoleFn / the bootstrap script)
 * or from the server-enforced admin probe. `super_admin` and `analysis` are intentionally not recognised (disabled).
 */
export type StaffRole = 'admin' | 'owner' | 'dispatch';
export type StaffArea = 'admin' | 'owner' | 'dispatch';

export const STAFF_ROLES: readonly StaffRole[] = ['admin', 'owner', 'dispatch'];

export function staffRoleFromClaims(claims: Record<string, unknown> | undefined | null, probedAdmin = false): StaffRole | null {
  if (probedAdmin) return 'admin';
  if (!claims) return null;
  if (claims.admin === true) return 'admin';
  const r = claims.role;
  return typeof r === 'string' && (STAFF_ROLES as readonly string[]).includes(r) ? (r as StaffRole) : null;
}

/** admin may open every back-office area; owner and dispatch only their own. */
export function canAccessArea(role: StaffRole | null | undefined, area: StaffArea): boolean {
  if (!role) return false;
  return role === 'admin' || role === area;
}

export function homeForRole(role: StaffRole): string {
  return role === 'owner' ? '/owner/dashboard' : role === 'dispatch' ? '/dispatch/dashboard' : '/admin/dashboard';
}
