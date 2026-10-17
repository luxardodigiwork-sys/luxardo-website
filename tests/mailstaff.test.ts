import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as staffNs from '../functions/src/staffRoles';
import * as resendNs from '../functions/src/resend';
import * as clientRoleNs from '../src/utils/staffRole';

const S: any = (staffNs as any).default ?? staffNs;
const R: any = (resendNs as any).default ?? resendNs;
const C: any = (clientRoleNs as any).default ?? clientRoleNs;

const fakeAuth = (user: any) => {
  const calls: any[] = [];
  return {
    calls,
    getUserByEmail: async (e: string) => { if (!user) throw new Error('nf'); return user; },
    setCustomUserClaims: async (uid: string, c: any) => { calls.push(['claims', uid, c]); },
    revokeRefreshTokens: async (uid: string) => { calls.push(['revoke', uid]); },
  };
};
const admin = { uid: 'adm', token: { admin: true }, allowedUids: [] as string[] };

test('only admins can manage roles; ADMIN_UIDS entries count; plain users and guests cannot', async () => {
  const u = { uid: 'u1', emailVerified: true };
  await assert.rejects(() => S.applyStaffRole(fakeAuth(u), { uid: 'x', token: {}, allowedUids: [] }, { email: 'a@b.co', role: 'owner' }), /Admin only/);
  await assert.rejects(() => S.applyStaffRole(fakeAuth(u), { uid: undefined, token: undefined, allowedUids: [] }, { email: 'a@b.co', role: 'owner' }), /Admin only/);
  await assert.rejects(() => S.applyStaffRole(fakeAuth(u), { uid: 'o', token: { role: 'owner' }, allowedUids: [] }, { email: 'a@b.co', role: 'owner' }), /Admin only/); // owner cannot grant roles
  const a = fakeAuth(u);
  assert.deepEqual(await S.applyStaffRole(a, { uid: 'boot', token: {}, allowedUids: ['boot'] }, { email: 'A@B.co', role: 'dispatch' }), { uid: 'u1', role: 'dispatch' });
  assert.deepEqual(a.calls[0], ['claims', 'u1', { role: 'dispatch' }]);
});

test('admin role sets role+admin claims; none clears them but keeps other claims', async () => {
  const a = fakeAuth({ uid: 'u1', emailVerified: true, customClaims: { keep: 1, role: 'owner', admin: true } });
  await S.applyStaffRole(a, admin, { email: 'a@b.co', role: 'admin' });
  assert.deepEqual(a.calls[0][2], { keep: 1, role: 'admin', admin: true });
  const b = fakeAuth({ uid: 'u1', emailVerified: true, customClaims: { keep: 1, role: 'owner' } });
  await S.applyStaffRole(b, admin, { email: 'a@b.co', role: 'none' });
  assert.deepEqual(b.calls[0][2], { keep: 1 });
  assert.equal(b.calls[1][0], 'revoke');
});

test('super_admin, analysis and junk roles/emails are rejected; unverified email and self-demotion are blocked', async () => {
  const u = { uid: 'u1', emailVerified: true };
  for (const role of ['super_admin', 'analysis', 'accounts', 'ADMIN', '', undefined, 5]) {
    await assert.rejects(() => S.applyStaffRole(fakeAuth(u), admin, { email: 'a@b.co', role }), /Role must be/);
  }
  await assert.rejects(() => S.applyStaffRole(fakeAuth(u), admin, { email: 'not-an-email', role: 'owner' }), /valid email/);
  await assert.rejects(() => S.applyStaffRole(fakeAuth({ uid: 'u2', emailVerified: false }), admin, { email: 'a@b.co', role: 'owner' }), /not verified/);
  await assert.rejects(() => S.applyStaffRole(fakeAuth(null), admin, { email: 'a@b.co', role: 'owner' }), /No account/);
  await assert.rejects(() => S.applyStaffRole(fakeAuth({ uid: 'adm', emailVerified: true }), admin, { email: 'a@b.co', role: 'owner' }), /own admin/);
});

test('client role helper: only admin|owner|dispatch are recognised; admin opens every area; others only their own', () => {
  assert.equal(C.staffRoleFromClaims({ role: 'owner' }), 'owner');
  assert.equal(C.staffRoleFromClaims({ role: 'dispatch' }), 'dispatch');
  assert.equal(C.staffRoleFromClaims({ admin: true }), 'admin');
  assert.equal(C.staffRoleFromClaims({}, true), 'admin');
  for (const r of ['super_admin', 'analysis', 'customer', 'Owner', 5, null]) assert.equal(C.staffRoleFromClaims({ role: r }), null);
  assert.equal(C.canAccessArea('admin', 'owner'), true);
  assert.equal(C.canAccessArea('owner', 'dispatch'), false);
  assert.equal(C.canAccessArea('dispatch', 'admin'), false);
  assert.equal(C.canAccessArea(null, 'dispatch'), false);
  assert.equal(C.homeForRole('owner'), '/owner/dashboard');
});

test('Resend: builds the request, uses an idempotency key, validates recipients, never leaks the key in errors', async () => {
  let seen: any;
  const ok = async (url: string, init: any) => { seen = { url, init }; return { ok: true, status: 200, json: async () => ({ id: 're_123' }) }; };
  const doc = { to: 'cust@example.com', message: { subject: 'Order', html: '<p>hi</p>', text: 'hi' } };
  assert.deepEqual(await R.sendViaResend(ok, 'KEY', 'Shop <a@b.co>', 'm1', doc), { ok: true, id: 're_123' });
  assert.equal(seen.url, 'https://api.resend.com/emails');
  assert.equal(seen.init.headers['Idempotency-Key'], 'mail-m1');
  assert.deepEqual(JSON.parse(seen.init.body).to, ['cust@example.com']);
  const bad = async () => ({ ok: false, status: 403, json: async () => ({ message: 'domain not verified KEY' }) });
  const r1 = await R.sendViaResend(bad, 'KEY', 'x', 'm2', doc);
  assert.equal(r1.ok, false); assert.match(r1.error, /resend 403/);
  const boom = async () => { throw new Error('socket hang up'); };
  assert.equal((await R.sendViaResend(boom, 'KEY', 'x', 'm3', doc)).ok, false);
  assert.equal((await R.sendViaResend(ok, '', 'x', 'm4', doc)).ok, false);
  assert.equal((await R.sendViaResend(ok, 'KEY', 'x', 'm5', { to: 'bad', message: { subject: 's', text: 't' } })).ok, false);
  assert.equal((await R.sendViaResend(ok, 'KEY', 'x', 'm6', { to: 'a@b.co', message: { subject: 's' } })).ok, false);
});
