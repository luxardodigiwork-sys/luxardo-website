/**
 * Role-based permissions matrix for LUXARDO FASHION staff portals.
 * Each module key maps to the set of roles allowed to view/edit it.
 *
 * Roles:
 *  - super_admin / admin → full access
 *  - owner              → executive + read-everything + business decisions
 *  - dispatch           → orders, courier, tracking only
 *  - accounts / analysis → payments, invoices, GST, reports only
 *  - customer           → public + own /account only
 */

export type Role =
  | 'super_admin'
  | 'admin'
  | 'owner'
  | 'dispatch'
  | 'accounts'
  | 'analysis'
  | 'customer'
  | string;

type Module =
  | 'admin.dashboard'
  | 'admin.orders'
  | 'admin.orders.update'
  | 'admin.products'
  | 'admin.products.edit'
  | 'admin.collections'
  | 'admin.media'
  | 'admin.content'
  | 'admin.policies'
  | 'admin.prime'
  | 'admin.bespoke'
  | 'admin.partners'
  | 'admin.contact'
  | 'admin.newsletter'
  | 'admin.settings'
  | 'admin.users'        // BackendManagementPage — create/manage staff
  | 'dispatch.dashboard'
  | 'dispatch.actions'   // mark shipped, add tracking, etc.
  | 'accounts.dashboard' // payments + invoices
  | 'accounts.refund'
  | 'analysis.dashboard' // reports + analytics
  | 'owner.dashboard';

const MATRIX: Record<Module, Role[]> = {
  // ── Admin module ───────────────────────────────
  'admin.dashboard':      ['super_admin', 'admin', 'owner'],
  'admin.orders':         ['super_admin', 'admin', 'owner', 'dispatch', 'accounts'],
  'admin.orders.update':  ['super_admin', 'admin', 'owner', 'dispatch'],
  'admin.products':       ['super_admin', 'admin', 'owner'],
  'admin.products.edit':  ['super_admin', 'admin'],
  'admin.collections':    ['super_admin', 'admin'],
  'admin.media':          ['super_admin', 'admin'],
  'admin.content':        ['super_admin', 'admin'],
  'admin.policies':       ['super_admin', 'admin'],
  'admin.prime':          ['super_admin', 'admin', 'owner'],
  'admin.bespoke':        ['super_admin', 'admin'],
  'admin.partners':       ['super_admin', 'admin', 'owner'],
  'admin.contact':        ['super_admin', 'admin'],
  'admin.newsletter':     ['super_admin', 'admin'],
  'admin.settings':       ['super_admin', 'admin'],
  'admin.users':          ['super_admin', 'admin', 'owner'], // staff management

  // ── Dispatch portal ────────────────────────────
  'dispatch.dashboard':   ['super_admin', 'admin', 'owner', 'dispatch'],
  'dispatch.actions':     ['super_admin', 'admin', 'dispatch'],

  // ── Accounts portal ────────────────────────────
  'accounts.dashboard':   ['super_admin', 'admin', 'owner', 'accounts', 'analysis'],
  'accounts.refund':      ['super_admin', 'admin', 'accounts'],

  // ── Analytics portal ───────────────────────────
  'analysis.dashboard':   ['super_admin', 'admin', 'owner', 'analysis', 'accounts'],

  // ── Owner portal ───────────────────────────────
  'owner.dashboard':      ['super_admin', 'admin', 'owner'],
};

/**
 * Check if a role can access a module.
 * Returns true for super_admin / admin always.
 */
export function can(role: Role | undefined | null, mod: Module): boolean {
  if (!role) return false;
  const r = String(role).toLowerCase();
  if (r === 'super_admin' || r === 'admin') return true;
  const allowed = MATRIX[mod];
  return !!allowed && allowed.includes(r);
}

/** Convenience: get all modules a role can access. */
export function modulesFor(role: Role | undefined | null): Module[] {
  if (!role) return [];
  return (Object.keys(MATRIX) as Module[]).filter((m) => can(role, m));
}

/** Friendly label for display. */
export function roleLabel(role: Role | undefined | null): string {
  switch ((role || '').toLowerCase()) {
    case 'super_admin': return 'Super Admin';
    case 'admin': return 'Admin';
    case 'owner': return 'Owner';
    case 'dispatch': return 'Dispatch';
    case 'accounts': return 'Accounts';
    case 'analysis': return 'Analytics';
    case 'customer': return 'Customer';
    default: return 'Guest';
  }
}
