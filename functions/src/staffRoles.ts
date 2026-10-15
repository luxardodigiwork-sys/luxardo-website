/** Staff role management (pure logic + a thin Admin-SDK applier). Roles are Firebase custom claims. */
export const STAFF_ROLES = ["admin", "owner", "dispatch"] as const;
export type StaffRoleInput = (typeof STAFF_ROLES)[number] | "none";

export class StaffRoleError extends Error {
  constructor(public code: "permission-denied" | "invalid-argument" | "not-found" | "failed-precondition", message: string) {
    super(message);
  }
}

export interface CallerInfo { uid?: string; token?: Record<string, unknown>; allowedUids: string[] }

/** Only an admin (claim `admin`, role claim `admin`, or an ADMIN_UIDS entry) may change roles. */
export function assertCanManageRoles(c: CallerInfo): void {
  const t = c.token || {};
  const ok = !!c.uid && (t.admin === true || t.role === "admin" || c.allowedUids.includes(c.uid));
  if (!ok) throw new StaffRoleError("permission-denied", "Admin only.");
}

export function parseRoleChange(data: unknown): { email: string; role: StaffRoleInput } {
  const d = (data ?? {}) as Record<string, unknown>;
  const email = typeof d.email === "string" ? d.email.trim().toLowerCase() : "";
  if (!/^[^@\s]{1,64}@[^@\s]{1,255}\.[^@\s]{2,}$/.test(email)) throw new StaffRoleError("invalid-argument", "Enter a valid email.");
  const role = d.role;
  if (typeof role !== "string" || !([...STAFF_ROLES, "none"] as string[]).includes(role)) {
    // super_admin / analysis / anything else is deliberately not assignable.
    throw new StaffRoleError("invalid-argument", "Role must be admin, owner, dispatch or none.");
  }
  return { email, role: role as StaffRoleInput };
}

export interface UserLike { uid: string; emailVerified?: boolean; providerData?: unknown[]; customClaims?: Record<string, unknown> }
export interface AuthLike {
  getUserByEmail(email: string): Promise<UserLike>;
  setCustomUserClaims(uid: string, claims: Record<string, unknown> | null): Promise<void>;
  revokeRefreshTokens(uid: string): Promise<void>;
}

/** Applies the change. A verified email is required so nobody can claim a role by pre-registering someone else's address. */
export async function applyStaffRole(auth: AuthLike, caller: CallerInfo, data: unknown): Promise<{ uid: string; role: StaffRoleInput }> {
  assertCanManageRoles(caller);
  const { email, role } = parseRoleChange(data);
  let user: UserLike;
  try {
    user = await auth.getUserByEmail(email);
  } catch {
    throw new StaffRoleError("not-found", "No account with this email. Ask them to sign in once first.");
  }
  if (user.uid === caller.uid && role !== "admin") {
    throw new StaffRoleError("failed-precondition", "You cannot remove or downgrade your own admin access.");
  }
  if (role !== "none" && user.emailVerified !== true) {
    throw new StaffRoleError("failed-precondition", "This email is not verified. Ask them to sign in with Google or verify their email first.");
  }
  const claims: Record<string, unknown> = { ...(user.customClaims || {}) };
  delete claims.role;
  delete claims.admin;
  if (role !== "none") {
    claims.role = role;
    if (role === "admin") claims.admin = true;
  }
  await auth.setCustomUserClaims(user.uid, Object.keys(claims).length ? claims : null);
  await auth.revokeRefreshTokens(user.uid); // forces a fresh token so the change applies quickly
  return { uid: user.uid, role };
}
