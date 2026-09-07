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
  | 'owner.dashboard'

  // ── Production (Loom) modules ─────────────────────
  | 'production.designs'
  | 'production.designs.write'
  | 'production.designs.approve'
  | 'production.sampleDesigns'
  | 'production.sampleDesigns.write'
  | 'production.sampleDesigns.approve'
  | 'production.samplePieces'
  | 'production.samplePieces.write'
  | 'production.requests'
  | 'production.requests.approve'
  | 'production.requests.reject'
  | 'production.requests.edit'
  | 'production.pieces'
  | 'production.pieces.move'
  | 'production.pieces.reverse'
  | 'production.pieces.replace'
  | 'production.pieces.assignKarigar'
  | 'production.karigars'
  | 'production.karigars.write'
  | 'production.labour'
  | 'production.labour.startStop'
  | 'production.qc'
  | 'production.qc.perform'
  | 'production.tailor'
  | 'production.tailor.startComplete'
  | 'production.store'
  | 'production.store.out'
  | 'production.store.out.issue'
  | 'production.reports'
  | 'production.reports.export'
  | 'production.audit'
  | 'production.staff'
  | 'production.movement';

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

  // ── Production (Loom) — read / write / control ──
  'production.designs':              ['super_admin','admin','owner','designer','pm','dispatch','tailor','store'],
  'production.designs.write':        ['super_admin','admin','owner','designer'],
  'production.designs.approve':      ['super_admin','admin','owner'],
  'production.sampleDesigns':        ['super_admin','admin','owner','designer','pm','dispatch'],
  'production.sampleDesigns.write':  ['super_admin','admin','owner','designer'],
  'production.sampleDesigns.approve':['super_admin','admin','owner'],
  'production.samplePieces':         ['super_admin','admin','owner','designer','pm','dispatch'],
  'production.samplePieces.write':   ['super_admin','admin','owner','designer'],
  'production.requests':             ['super_admin','admin','owner','pm','dispatch'],
  'production.requests.approve':     ['super_admin','admin','owner'],
  'production.requests.reject':      ['super_admin','owner'],
  'production.requests.edit':        ['super_admin','admin','owner'],
  'production.pieces':               ['super_admin','admin','owner','pm','dispatch','guard','tailor','store'],
  'production.pieces.move':          ['super_admin','admin','owner','pm','dispatch','guard'],
  'production.pieces.reverse':       ['super_admin','admin','owner'],
  'production.pieces.replace':       ['super_admin','admin','owner','pm'],
  'production.pieces.assignKarigar': ['super_admin','admin','owner','pm'],
  'production.karigars':             ['super_admin','admin','owner','pm','dispatch'],
  'production.karigars.write':       ['super_admin','admin','owner','pm'],
  'production.labour':               ['super_admin','admin','owner','pm','dispatch'],
  'production.labour.startStop':     ['super_admin','admin','owner','pm'],
  'production.qc':                   ['super_admin','admin','owner','pm','dispatch','guard'],
  'production.qc.perform':           ['guard'],
  'production.tailor':               ['super_admin','admin','owner','pm','dispatch','tailor'],
  'production.tailor.startComplete': ['super_admin','admin','owner','dispatch','tailor'],
  'production.store':                ['super_admin','admin','owner','designer','pm','dispatch'],
  'production.store.out':            ['super_admin','admin','owner','dispatch'],
  'production.store.out.issue':      ['super_admin','admin','owner','pm','dispatch'],
  'production.reports':              ['super_admin','owner'],
  'production.reports.export':       ['super_admin','owner'],
  'production.audit':                ['super_admin','admin','owner'],
  'production.staff':                ['super_admin','admin','owner'],
  'production.movement':             ['super_admin','admin','owner','pm','dispatch','guard','tailor'],
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
    case 'designer': return 'Designer';
    case 'pm': return 'Production Manager';
    case 'guard': return 'Guard';
    case 'tailor': return 'Tailor';
    case 'store': return 'Store';
    case 'customer': return 'Customer';
    default: return 'Guest';
  }
}
