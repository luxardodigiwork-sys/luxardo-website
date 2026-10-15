// Security-rules tests. Run with:  npm run test:rules   (starts the Firebase emulators)
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, getDocs, collection, deleteDoc, query, where, increment } from 'firebase/firestore';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';

const ADMIN_UID = '0Frc6Dy2MqN0zc0UFkmqvpELFnr1'; // owner UID allow-list in the rules
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    storage: { rules: readFileSync('storage.rules', 'utf8') },
  });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); await env.clearStorage(); });

const customer = (uid = 'cust1') => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'phone' } });
const anon = (uid = 'anon1') => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } });
const admin = () => env.authenticatedContext(ADMIN_UID, { firebase: { sign_in_provider: 'phone' } });
const claimAdmin = () => env.authenticatedContext('claimAdmin', { admin: true, firebase: { sign_in_provider: 'phone' } });
const png = () => new Uint8Array([137, 80, 78, 71]);

// ---------- customers / role escalation ----------
test('customer can create own profile with role=customer', async () => {
  await assertSucceeds(setDoc(doc(customer().firestore(), 'customers/cust1'), { firstName: 'A', role: 'customer', isPrimeMember: false }));
});
test('customer cannot create profile with role=admin / prime / permissions', async () => {
  const db = customer().firestore();
  await assertFails(setDoc(doc(db, 'customers/cust1'), { role: 'super_admin' }));
  await assertFails(setDoc(doc(db, 'customers/cust1'), { role: 'customer', isPrimeMember: true }));
  await assertFails(setDoc(doc(db, 'customers/cust1'), { role: 'customer', permissions: { x: true } }));
});
test('customer can update harmless fields but not role/prime/permissions', async () => {
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'customers/cust1'), { firstName: 'A', role: 'customer', isPrimeMember: false }));
  const db = customer().firestore();
  await assertSucceeds(updateDoc(doc(db, 'customers/cust1'), { country: 'IN', currency: 'INR', language: 'en' }));
  await assertFails(updateDoc(doc(db, 'customers/cust1'), { role: 'admin' }));
  await assertFails(updateDoc(doc(db, 'customers/cust1'), { isPrimeMember: true }));
  await assertFails(updateDoc(doc(db, 'customers/cust1'), { primePrivileges: { bespoke: true } }));
  await assertFails(updateDoc(doc(db, 'customers/cust1'), { membershipExpiry: '2099-01-01' }));
});
test('customer cannot read or write another customer profile', async () => {
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'customers/other'), { firstName: 'B' }));
  await assertFails(getDoc(doc(customer().firestore(), 'customers/other')));
  await assertFails(setDoc(doc(customer().firestore(), 'customers/other'), { firstName: 'X' }));
});
test('admin can edit privileged fields', async () => {
  await assertSucceeds(setDoc(doc(admin().firestore(), 'customers/cust1'), { role: 'customer', isPrimeMember: true }));
});

// ---------- admin probe ----------
test('adminCheck probe readable only by admins (UID list or claim)', async () => {
  await assertSucceeds(getDoc(doc(admin().firestore(), 'adminCheck/probe')));
  await assertSucceeds(getDoc(doc(claimAdmin().firestore(), 'adminCheck/probe')));
  await assertFails(getDoc(doc(customer().firestore(), 'adminCheck/probe')));
  await assertFails(getDoc(doc(anon().firestore(), 'adminCheck/probe')));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'adminCheck/probe')));
});

// ---------- products ----------
test('products: public read, admin-only write', async () => {
  await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'products/p1')));
  await assertFails(setDoc(doc(customer().firestore(), 'products/p1'), { price: 1 }));
  await assertFails(setDoc(doc(anon().firestore(), 'products/p1'), { price: 1 }));
  await assertSucceeds(setDoc(doc(admin().firestore(), 'products/p1'), { name: 'P1', price: 1000, stock: 5 }));
});

test('products: admin writes must have a name, non-negative price and integer stock >= 0', async () => {
  const db = admin().firestore();
  await assertSucceeds(setDoc(doc(db, 'products/p2'), { name: 'X', price: 100, stock: 0 }));
  await assertFails(setDoc(doc(db, 'products/p3'), { name: 'X', price: -1, stock: 1 }));
  await assertFails(setDoc(doc(db, 'products/p4'), { name: 'X', price: 10, stock: -5 }));
  await assertFails(setDoc(doc(db, 'products/p5'), { name: 'X', price: '10' }));
  await assertFails(setDoc(doc(db, 'products/p6'), { price: 10 }));
  await assertSucceeds(deleteDoc(doc(db, 'products/p2')));
});

// ---------- orders ----------
const baseOrder = (uid) => ({ userId: uid, status: 'pending_payment', paymentStatus: 'pending', totalAmount: 100 });
test('orders: no client can create an order (guest, anonymous, phone user, even a "pending" one)', async () => {
  for (const ctx of [env.unauthenticatedContext(), anon('g1'), customer('cust1')]) {
    const db = ctx.firestore();
    await assertFails(setDoc(doc(db, 'orders/o1'), baseOrder('cust1')));
    await assertFails(setDoc(doc(db, 'orders/o2'), { ...baseOrder('cust1'), status: 'placed', paymentStatus: 'paid' }));
  }
});
test('orders: client cannot update/delete own order (e.g. mark paid or change total); owner reads, others cannot', async () => {
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'orders/o1'), baseOrder('cust1')));
  const db = customer().firestore();
  await assertFails(updateDoc(doc(db, 'orders/o1'), { paymentStatus: 'paid' }));
  await assertFails(updateDoc(doc(db, 'orders/o1'), { totalAmount: 1 }));
  await assertFails(deleteDoc(doc(db, 'orders/o1')));
  await assertSucceeds(getDoc(doc(db, 'orders/o1')));
  await assertFails(getDoc(doc(customer('cust2').firestore(), 'orders/o1')));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'orders/o1')));
  await assertSucceeds(updateDoc(doc(admin().firestore(), 'orders/o1'), { internalRemarks: 'note' })); // fulfilment field, status unchanged
});
test('orders: admin may update fulfilment fields of PAID orders but never money/payment/stock fields', async () => {
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'orders/paid1'), { ...baseOrder('cust1'), status: 'processing', paymentStatus: 'paid', items: [{ productId: 'a' }], stockReserved: true }));
  const db = admin().firestore();
  await assertSucceeds(updateDoc(doc(db, 'orders/paid1'), { status: 'shipped', trackingId: 'DTDC123', courierName: 'DTDC', dispatchDate: '2026-10-12' }));
  for (const bad of [{ paymentStatus: 'refunded' }, { totalAmount: 1 }, { amountPaise: 1 }, { items: [] }, { razorpayPaymentId: 'x' }, { userId: 'other' }, { stockReleased: true }]) {
    await assertFails(updateDoc(doc(db, 'orders/paid1'), bad));
  }
  await assertFails(updateDoc(doc(db, 'orders/paid1'), { status: 'cancelled' })); // must use cancelOrderFn so stock is restored
  await assertFails(deleteDoc(doc(db, 'orders/paid1')));
});
test('orders: cancellation/refund flags are server-only - neither customers nor the admin UI can set them', async () => {
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'orders/c1'), { ...baseOrder('cust1'), status: 'processing', paymentStatus: 'paid' }));
  for (const bad of [{ cancellationRequest: { status: 'requested' } }, { returnRequest: { status: 'requested' } }, { needsRefund: true }, { needsRefund: false }, { statusReason: 'cancelled_by_customer' }]) {
    await assertFails(updateDoc(doc(customer().firestore(), 'orders/c1'), bad));
    await assertFails(updateDoc(doc(admin().firestore(), 'orders/c1'), bad));
  }
});
test('products: an admin edit without stock keeps live stock; a stock change is a delta; stock can never go negative', async () => {
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'products/live1'), { name: 'Live', price: 1000, stock: 5, visibility: 'public' }));
  // a customer reserves 2 while the admin has the edit form open
  await env.withSecurityRulesDisabled(c => updateDoc(doc(c.firestore(), 'products/live1'), { stock: 3 }));
  const db = admin().firestore();
  // admin saves other fields (the way productStore.update does): merge write WITHOUT stock
  await assertSucceeds(setDoc(doc(db, 'products/live1'), { name: 'Live', price: 1200, visibility: 'hidden' }, { merge: true }));
  let kept;
  await env.withSecurityRulesDisabled(async c => { kept = (await getDoc(doc(c.firestore(), 'products/live1'))).data().stock; });
  assert.equal(kept, 3); // the reservation was NOT undone by the admin edit
  // staff add 4 units: increment on top of the live 3 => 7 (not an overwrite)
  await assertSucceeds(setDoc(doc(db, 'products/live1'), { stock: increment(4) }, { merge: true }));
  let stock;
  await env.withSecurityRulesDisabled(async c => { stock = (await getDoc(doc(c.firestore(), 'products/live1'))).data().stock; });
  assert.equal(stock, 7);
  // removing more than exists is refused by the rules
  await assertFails(setDoc(doc(db, 'products/live1'), { stock: increment(-100) }, { merge: true }));
});
test('orders: staff cannot revive a cancelled / on-hold / stock-released paid order (would oversell the same piece)', async () => {
  const dead = [
    ['cancelled', { status: 'cancelled', stockReleased: true }],
    ['on_hold', { status: 'on_hold', needsRefund: true }],
    ['processing_but_stock_released', { status: 'processing', stockReleased: true }],
  ];
  for (const [id, extra] of dead) {
    await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), `orders/rev_${id}`), { ...baseOrder('cust1'), paymentStatus: 'paid', ...extra }));
    for (const next of ['processing', 'packed', 'shipped', 'delivered']) {
      if (next === extra.status) continue; // unchanged status is not a revival
      await assertFails(updateDoc(doc(admin().firestore(), `orders/rev_${id}`), { status: next }));
    }
  }
  // the normal forward flow for a live paid order still works
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'orders/live1'), { ...baseOrder('cust1'), paymentStatus: 'paid', status: 'processing', stockReserved: true, stockReleased: false }));
  await assertSucceeds(updateDoc(doc(admin().firestore(), 'orders/live1'), { status: 'packed' }));
  await assertSucceeds(updateDoc(doc(admin().firestore(), 'orders/live1'), { status: 'shipped', trackingId: 'T1' }));
});
test('orders: admin cannot mark an UNPAID order paid or push it forward', async () => {
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'orders/unpaid1'), baseOrder('cust1')));
  const db = admin().firestore();
  await assertFails(updateDoc(doc(db, 'orders/unpaid1'), { paymentStatus: 'paid' }));
  await assertFails(updateDoc(doc(db, 'orders/unpaid1'), { status: 'processing' }));
  await assertFails(updateDoc(doc(db, 'orders/unpaid1'), { status: 'shipped' }));
  await assertSucceeds(updateDoc(doc(db, 'orders/unpaid1'), { internalRemarks: 'called customer' }));
});
test('orders: customer can list only their own orders; admin can list all', async () => {
  await env.withSecurityRulesDisabled(async c => {
    await setDoc(doc(c.firestore(), 'orders/o1'), baseOrder('cust1'));
    await setDoc(doc(c.firestore(), 'orders/o2'), baseOrder('cust2'));
  });
  await assertFails(getDocs(collection(customer().firestore(), 'orders')));
  await assertSucceeds(getDocs(query(collection(customer().firestore(), 'orders'), where('userId', '==', 'cust1'))));
  await assertSucceeds(getDocs(collection(admin().firestore(), 'orders')));
});
test('webhookEvents and other server-only collections are closed to all clients incl. admins', async () => {
  await assertFails(setDoc(doc(admin().firestore(), 'webhookEvents/e1'), { a: 1 }));
  await assertFails(getDoc(doc(admin().firestore(), 'webhookEvents/e1')));
});

// ---------- sessions / favorites / lowStock ----------
test('sessions: get by id ok, no listing, only whitelisted keys', async () => {
  const pub = env.unauthenticatedContext().firestore();
  await assertSucceeds(setDoc(doc(pub, 'sessions/s1'), { country: 'IN', currency: 'INR', language: 'en', updatedAt: 'x' }));
  await assertFails(setDoc(doc(pub, 'sessions/s2'), { country: 'IN', evil: 'payload' }));
  await assertSucceeds(getDoc(doc(pub, 'sessions/s1')));
  await assertFails(getDocs(collection(pub, 'sessions')));
  await assertSucceeds(getDocs(collection(admin().firestore(), 'sessions')));
});
test('favorites: owner only, id prefixed by uid', async () => {
  const db = customer().firestore();
  await assertSucceeds(setDoc(doc(db, 'favorites/cust1_p1'), { userId: 'cust1', productId: 'p1' }));
  await assertFails(setDoc(doc(db, 'favorites/other_p1'), { userId: 'other' }));
  await assertFails(getDoc(doc(customer('cust2').firestore(), 'favorites/cust1_p1')));
  await assertSucceeds(deleteDoc(doc(db, 'favorites/cust1_p1')));
});
test('lowStockNotifications: registered users manage their own', async () => {
  await assertSucceeds(setDoc(doc(customer().firestore(), 'lowStockNotifications/cust1_p1'), { userId: 'cust1' }));
  await assertFails(setDoc(doc(anon().firestore(), 'lowStockNotifications/anon1_p1'), { userId: 'anon1' }));
});
test('unknown collections are closed (even to admins)', async () => {
  await assertFails(setDoc(doc(admin().firestore(), 'whatever/x'), { a: 1 }));
});

// ---------- storage ----------
const meta = (contentType) => ({ contentType });
test('storage: public read, anonymous/customer cannot write elsewhere', async () => {
  await env.withSecurityRulesDisabled(c => uploadBytes(ref(c.storage(), 'products/a.png'), png(), meta('image/png')));
  await assertSucceeds(getBytes(ref(env.unauthenticatedContext().storage(), 'products/a.png')));
  await assertFails(uploadBytes(ref(anon().storage(), 'products/b.png'), png(), meta('image/png')));
  await assertFails(uploadBytes(ref(customer().storage(), 'products/b.png'), png(), meta('image/png')));
  await assertFails(deleteObject(ref(customer().storage(), 'products/a.png')));
});
test('storage: admin may upload images only, within the size limit', async () => {
  const s = admin().storage();
  await assertSucceeds(uploadBytes(ref(s, 'products/ok.png'), png(), meta('image/png')));
  await assertFails(uploadBytes(ref(s, 'products/x.html'), new Uint8Array([60]), meta('text/html')));
  await assertFails(uploadBytes(ref(s, 'products/big.png'), new Uint8Array(51 * 1024 * 1024), meta('image/png')));
});
test('storage: customer uploads only to own folder, images <=5MB, not anonymous', async () => {
  await assertSucceeds(uploadBytes(ref(customer().storage(), 'user-uploads/cust1/me.png'), png(), meta('image/png')));
  await assertFails(uploadBytes(ref(customer().storage(), 'user-uploads/other/me.png'), png(), meta('image/png')));
  await assertFails(uploadBytes(ref(anon().storage(), 'user-uploads/anon1/me.png'), png(), meta('image/png')));
  await assertFails(uploadBytes(ref(customer().storage(), 'user-uploads/cust1/big.png'), new Uint8Array(6 * 1024 * 1024), meta('image/png')));
  await assertFails(uploadBytes(ref(customer().storage(), 'user-uploads/cust1/a.pdf'), png(), meta('application/pdf')));
});
test('storage: customer uploads are private (owner/admin read only); catalogue stays public', async () => {
  await env.withSecurityRulesDisabled(c => uploadBytes(ref(c.storage(), 'user-uploads/cust1/priv.png'), png(), meta('image/png')));
  await assertSucceeds(getBytes(ref(customer().storage(), 'user-uploads/cust1/priv.png')));
  await assertSucceeds(getBytes(ref(admin().storage(), 'user-uploads/cust1/priv.png')));
  await assertFails(getBytes(ref(env.unauthenticatedContext().storage(), 'user-uploads/cust1/priv.png')));
  await assertFails(getBytes(ref(anon().storage(), 'user-uploads/cust1/priv.png')));
});
test('storage: admin custom claim can upload too', async () => {
  await assertSucceeds(uploadBytes(ref(claimAdmin().storage(), 'products/claim.png'), png(), meta('image/png')));
});

test('legacy site content: public read, admin-only write, and a self-assigned profile role grants nothing', async () => {
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'siteContent/home'), { hero: 'x' }));
  await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'siteContent/home')));
  await assertFails(setDoc(doc(anon().firestore(), 'siteContent/home'), { hero: 'hack' }));
  await assertFails(setDoc(doc(customer().firestore(), 'siteContent/home'), { hero: 'hack' }));
  await assertSucceeds(setDoc(doc(admin().firestore(), 'siteContent/home'), { hero: 'ok' }));
  // privilege escalation attempt: customer writes role:'admin' on their own profile, then tries admin-only writes
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'customers/cust1'), { role: 'admin', name: 'x' }));
  await assertFails(setDoc(doc(customer().firestore(), 'siteContent/home'), { hero: 'hack' }));
  await assertFails(setDoc(doc(customer().firestore(), 'products/p-hack'), { name: 'x', price: 1, stock: 1 }));
  await assertFails(setDoc(doc(customer().firestore(), 'orders/fake1'), { userId: 'cust1', paymentStatus: 'paid', total: 1 }));
});
test('forms: anyone may submit, only admins read', async () => {
  await assertSucceeds(setDoc(doc(env.unauthenticatedContext().firestore(), 'contactMessages/m1'), { name: 'a', message: 'hi' }));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'contactMessages/m1')));
  await assertSucceeds(getDoc(doc(admin().firestore(), 'contactMessages/m1')));
});

const withRole = (uid, role) => env.authenticatedContext(uid, { role, firebase: { sign_in_provider: 'password' } });
test('staff roles: owner reads orders (read-only), dispatch updates fulfilment fields only, admin claim role works; unknown roles grant nothing', async () => {
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'orders/s1'), { ...baseOrder('cust1'), status: 'processing', paymentStatus: 'paid', items: [{ productId: 'a' }], stockReserved: true }));
  const owner = withRole('own1', 'owner').firestore();
  const dispatch = withRole('dis1', 'dispatch').firestore();
  const roleAdmin = withRole('adm1', 'admin').firestore();
  // owner: read-only
  await assertSucceeds(getDoc(doc(owner, 'orders/s1')));
  await assertFails(updateDoc(doc(owner, 'orders/s1'), { internalRemarks: 'x' }));
  await assertFails(setDoc(doc(owner, 'products/p9'), { name: 'x', price: 1, stock: 1 }));
  // dispatch: reads orders, may ship, may NOT touch money/items/payment, may not read customers or edit products
  await assertSucceeds(getDoc(doc(dispatch, 'orders/s1')));
  await assertSucceeds(updateDoc(doc(dispatch, 'orders/s1'), { status: 'shipped', trackingId: 'T1', courierName: 'DTDC' }));
  for (const bad of [{ paymentStatus: 'refunded' }, { totalAmount: 1 }, { items: [] }, { userId: 'x' }]) await assertFails(updateDoc(doc(dispatch, 'orders/s1'), bad));
  await assertFails(getDoc(doc(dispatch, 'customers/cust1')));
  await assertFails(setDoc(doc(dispatch, 'products/p9'), { name: 'x', price: 1, stock: 1 }));
  // role claim "admin" works like the admin claim; owner role can read customers
  await assertSucceeds(setDoc(doc(roleAdmin, 'products/p9'), { name: 'x', price: 1, stock: 1 }));
  await assertSucceeds(getDoc(doc(owner, 'customers/cust1')));
  // super_admin / analysis / customer are NOT staff roles
  for (const r of ['super_admin', 'analysis', 'customer', 'Admin']) {
    const db = withRole('x_' + r, r).firestore();
    await assertFails(getDoc(doc(db, 'orders/s1')));
    await assertFails(setDoc(doc(db, 'products/p10'), { name: 'x', price: 1, stock: 1 }));
  }
  // a customer cannot become staff by editing their own profile
  await assertFails(setDoc(doc(customer().firestore(), 'customers/cust1'), { role: 'owner' }));
});
test('storage: role claim admin may upload, owner/dispatch may not', async () => {
  await assertSucceeds(uploadBytes(ref(withRole('adm1', 'admin').storage(), 'products/r1.png'), png(), meta('image/png')));
  await assertFails(uploadBytes(ref(withRole('own1', 'owner').storage(), 'products/r2.png'), png(), meta('image/png')));
  await assertFails(uploadBytes(ref(withRole('dis1', 'dispatch').storage(), 'products/r3.png'), png(), meta('image/png')));
});
