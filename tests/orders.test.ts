// Order / stock / payment state machine against the Firestore emulator (no Razorpay credentials needed:
// the Razorpay client is a fake). Run via `npm test` (starts the emulator).
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as ordersNs from '../functions/src/orders';
import * as coreNs from '../functions/src/core';
import type { RazorpayLike } from '../functions/src/orders';
const unwrap = <T,>(m: T): T => (m as any).default ?? m;
const { applyCapturedPayment, createCheckoutOrder, recordPaymentFailure, releaseExpiredOrders, releaseOrderStock, verifyAndApplyPayment } = unwrap(ordersNs);
const { OrderError, validateShippingAddress } = unwrap(coreNs);
const { requestCancellation, requestReturn } = unwrap(ordersNs);
import * as webhookNs from '../functions/src/webhook';
import * as emailsNs from '../functions/src/emails';
import { createHmac } from 'node:crypto';
const { processWebhook } = unwrap(webhookNs);
const { buildMailDocs, buildCustomerEmail } = unwrap(emailsNs);
// Existing tests use small prices, so they run with the shipping rule switched off; shipping has its own tests below.
const NO_RULE = { thresholdPaise: 0, feeBelowThresholdPaise: 0 };

const requireFromFunctions = createRequire(new URL('../functions/package.json', import.meta.url));
const admin = requireFromFunctions('firebase-admin');
let db: FirebaseFirestore.Firestore;

const address = validateShippingAddress({ fullName: 'A', email: 'a@b.com', phone: '9876543210', addressLine1: 'x', city: 'c', state: 'Delhi', postalCode: '110001' });

let rzSeq = 0;
function fakeRazorpay(opts: { failCreate?: boolean; payments?: Record<string, any> } = {}) {
  const created: any[] = [];
  const rz: RazorpayLike & { created: any[] } = {
    created,
    orders: { async create(o) { if (opts.failCreate) throw new Error('razorpay down'); created.push(o); return { id: `order_rz${++rzSeq}`, amount: o.amount, currency: o.currency }; } },
    payments: { async fetch(id) { const p = opts.payments?.[id]; if (!p) throw new Error('no such payment'); return p; } },
  };
  return rz;
}

const stockOf = async (id: string) => (await db.collection('products').doc(id).get()).data()!.stock as number;
const orderOf = async (id: string) => (await db.collection('orders').doc(id).get()).data()!;
const captured = (o: { razorpayOrderId: string; amountPaise: number }, id = 'pay_1') => ({ id, order_id: o.razorpayOrderId, status: 'captured', amount: o.amountPaise, currency: 'INR' });

async function wipe() {
  for (const col of ['products', 'orders', 'webhookEvents', 'mail']) {
    const snap = await db.collection(col).get();
    await Promise.all(snap.docs.map((d: any) => d.ref.delete()));
  }
}
async function seed() {
  await db.collection('products').doc('a').set({ name: 'Fabric A', price: 1000, stock: 5 });
  await db.collection('products').doc('b').set({ name: 'Fabric B', price: 2500.5, stock: 1 });
}
const buy = (rz: RazorpayLike, lines: any, uid = 'u1', now?: Date, shipping: any = NO_RULE) => createCheckoutOrder(db, rz, { uid, lines, address, now, shipping });

before(() => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'Run via `npm test` so the Firestore emulator is used.');
  admin.initializeApp({ projectId: 'orders-test' });
  db = admin.firestore();
});
beforeEach(async () => { await wipe(); await seed(); });

test('creates a server-priced order, reserves stock, and asks Razorpay for the server total in paise', async () => {
  const rz = fakeRazorpay();
  const res = await buy(rz, [{ productId: 'a', quantity: 2, size: '42', price: 1, totalAmount: 1 }, { productId: 'b', quantity: 1, size: '40' }]);
  assert.equal(res.amountPaise, 450050); // 2*1000 + 2500.50
  assert.equal(rz.created[0].amount, 450050);
  assert.equal(rz.created[0].currency, 'INR');
  const o = await orderOf(res.orderId);
  assert.equal(o.status, 'pending'); assert.equal(o.paymentStatus, 'pending');
  assert.equal(o.userName, 'A'); assert.equal(o.shippingAmount, 0); assert.equal(o.totalAmount, 4500.5);
  assert.equal(o.taxAmount, null); assert.equal(o.taxTreatment, 'unconfirmed'); // no tax is invented
  assert.equal(o.razorpayOrderId, res.razorpayOrderId);
  assert.equal(await stockOf('a'), 3); assert.equal(await stockOf('b'), 0);
});

test('insufficient stock or bad input creates no order and changes no stock', async () => {
  const rz = fakeRazorpay();
  await assert.rejects(buy(rz, [{ productId: 'a', quantity: 6, size: '40' }]), (e: any) => e instanceof OrderError && e.code === 'failed-precondition');
  await assert.rejects(buy(rz, [{ productId: 'nope', quantity: 1, size: '40' }]), OrderError);
  assert.equal(await stockOf('a'), 5);
  assert.equal((await db.collection('orders').get()).size, 0);
  assert.equal(rz.created.length, 0);
});

test('concurrent orders cannot oversell the last unit', async () => {
  const rz = fakeRazorpay();
  const results = await Promise.allSettled([1, 2, 3, 4].map((i) => buy(rz, [{ productId: 'b', quantity: 1, size: '40' }], `u${i}`)));
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(await stockOf('b'), 0);
});

test('Razorpay failure rolls the reservation back', async () => {
  await assert.rejects(buy(fakeRazorpay({ failCreate: true }), [{ productId: 'a', quantity: 2, size: '40' }]), /razorpay down/);
  assert.equal(await stockOf('a'), 5);
  const orders = await db.collection('orders').get();
  assert.equal(orders.size, 1); assert.equal(orders.docs[0].data().status, 'cancelled');
});

test('captured payment marks the order paid once; replays and duplicate webhook events change nothing', async () => {
  const res = await buy(fakeRazorpay(), [{ productId: 'a', quantity: 2, size: '40' }]);
  const o = await orderOf(res.orderId);
  const pay = captured(o as any);
  assert.deepEqual(await applyCapturedPayment(db, { razorpayOrderId: o.razorpayOrderId, payment: pay, eventId: 'evt_1' }), { result: 'paid' });
  const after = await orderOf(res.orderId);
  assert.equal(after.status, 'processing'); assert.equal(after.paymentStatus, 'paid'); assert.equal(after.razorpayPaymentId, 'pay_1');
  assert.equal(await stockOf('a'), 3);
  // same webhook event delivered again
  assert.deepEqual(await applyCapturedPayment(db, { razorpayOrderId: o.razorpayOrderId, payment: pay, eventId: 'evt_1' }), { result: 'duplicate_event' });
  // same payment via a different event id (e.g. order.paid after payment.captured)
  assert.deepEqual(await applyCapturedPayment(db, { razorpayOrderId: o.razorpayOrderId, payment: pay, eventId: 'evt_2' }), { result: 'already_paid' });
  assert.equal(await stockOf('a'), 3); // stock untouched by replays
});

test('concurrent verify + webhook for one payment yields exactly one transition', async () => {
  const res = await buy(fakeRazorpay(), [{ productId: 'a', quantity: 1, size: '40' }]);
  const o = await orderOf(res.orderId);
  const pay = captured(o as any);
  const out = await Promise.all([
    applyCapturedPayment(db, { orderId: res.orderId, payment: pay }),
    applyCapturedPayment(db, { razorpayOrderId: o.razorpayOrderId, payment: pay, eventId: 'evt_x' }),
    applyCapturedPayment(db, { razorpayOrderId: o.razorpayOrderId, payment: pay, eventId: 'evt_x' }),
  ]);
  assert.equal(out.filter((r) => r.result === 'paid').length, 1);
  assert.equal(await stockOf('a'), 4);
});

test('wrong amount, currency, order id, or uncaptured payment never marks paid', async () => {
  const res = await buy(fakeRazorpay(), [{ productId: 'a', quantity: 1, size: '40' }]);
  const o = await orderOf(res.orderId);
  const base = captured(o as any);
  for (const bad of [{ amount: 100 }, { currency: 'USD' }, { order_id: 'order_other' }, { status: 'authorized' }, { status: 'failed' }]) {
    await assert.rejects(applyCapturedPayment(db, { orderId: res.orderId, payment: { ...base, ...bad } }), OrderError);
  }
  const after = await orderOf(res.orderId);
  assert.equal(after.paymentStatus, 'pending'); assert.equal(after.status, 'pending');
});

test('payment.failed is recorded (idempotently), keeps the reservation, and a later success still works', async () => {
  const res = await buy(fakeRazorpay(), [{ productId: 'a', quantity: 2, size: '40' }]);
  const o = await orderOf(res.orderId);
  const f = { razorpayOrderId: o.razorpayOrderId, paymentId: 'pay_bad', reason: 'BAD_REQUEST_ERROR', eventId: 'evt_f' };
  assert.equal(await recordPaymentFailure(db, f), 'recorded');
  assert.equal(await recordPaymentFailure(db, f), 'duplicate_event');
  let cur = await orderOf(res.orderId);
  assert.equal(cur.paymentStatus, 'pending'); assert.equal(cur.status, 'pending'); assert.equal(cur.lastPaymentError, 'BAD_REQUEST_ERROR');
  assert.equal(await stockOf('a'), 3);
  await applyCapturedPayment(db, { razorpayOrderId: o.razorpayOrderId, payment: captured(o as any, 'pay_ok'), eventId: 'evt_ok' });
  cur = await orderOf(res.orderId);
  assert.equal(cur.paymentStatus, 'paid');
});

test('verify flow: owner check, uncaptured => pending, captured => paid, foreign payment refused', async () => {
  const lines = [{ productId: 'a', quantity: 1, size: '40' }];
  const res = await buy(fakeRazorpay(), lines, 'owner');
  const o = await orderOf(res.orderId);
  const payments = {
    pay_auth: { ...captured(o as any, 'pay_auth'), status: 'authorized' },
    pay_ok: captured(o as any, 'pay_ok'),
    pay_foreign: { ...captured(o as any, 'pay_foreign'), order_id: 'order_someone_else' },
  };
  const rz = fakeRazorpay({ payments });
  await assert.rejects(verifyAndApplyPayment(db, rz, { uid: 'attacker', orderId: res.orderId, razorpayPaymentId: 'pay_ok' }), (e: any) => e.code === 'not-found');
  assert.deepEqual(await verifyAndApplyPayment(db, rz, { uid: 'owner', orderId: res.orderId, razorpayPaymentId: 'pay_auth' }), { result: 'pending' });
  await assert.rejects(verifyAndApplyPayment(db, rz, { uid: 'owner', orderId: res.orderId, razorpayPaymentId: 'pay_foreign' }), (e: any) => e.code === 'permission-denied');
  assert.equal((await orderOf(res.orderId)).paymentStatus, 'pending');
  assert.deepEqual(await verifyAndApplyPayment(db, rz, { uid: 'owner', orderId: res.orderId, razorpayPaymentId: 'pay_ok' }), { result: 'paid' });
  assert.deepEqual(await verifyAndApplyPayment(db, rz, { uid: 'owner', orderId: res.orderId, razorpayPaymentId: 'pay_ok' }), { result: 'already_paid' });
});

test('expiry sweep releases stock exactly once; unpaid-and-expired order cannot be released twice', async () => {
  const t0 = new Date('2026-10-11T05:30:00Z');
  const res = await buy(fakeRazorpay(), [{ productId: 'a', quantity: 3, size: '40' }], 'u1', t0);
  assert.equal(await stockOf('a'), 2);
  assert.equal(await releaseExpiredOrders(db, new Date(t0.getTime() + 10 * 60_000)), 0); // still within window
  assert.equal(await releaseExpiredOrders(db, new Date(t0.getTime() + 31 * 60_000)), 1);
  assert.equal(await releaseExpiredOrders(db, new Date(t0.getTime() + 60 * 60_000)), 0);
  assert.equal(await stockOf('a'), 5);
  assert.equal((await orderOf(res.orderId)).status, 'cancelled'); assert.equal((await orderOf(res.orderId)).statusReason, 'payment_window_elapsed');
});

test('paid orders are never swept; late payment after expiry re-reserves stock or holds for refund', async () => {
  const t0 = new Date('2026-10-11T05:30:00Z');
  const paid = await buy(fakeRazorpay(), [{ productId: 'a', quantity: 1, size: '40' }], 'u1', t0);
  const po = await orderOf(paid.orderId);
  await applyCapturedPayment(db, { orderId: paid.orderId, payment: captured(po as any, 'pay_p') });
  assert.equal(await releaseExpiredOrders(db, new Date(t0.getTime() + 120 * 60_000)), 0);
  assert.equal(await stockOf('a'), 4);

  // expired order, stock still available => paid + re-reserved
  const late = await buy(fakeRazorpay(), [{ productId: 'a', quantity: 2, size: '40' }], 'u2', t0);
  await releaseExpiredOrders(db, new Date(t0.getTime() + 40 * 60_000));
  const lo = await orderOf(late.orderId);
  assert.deepEqual(await applyCapturedPayment(db, { orderId: late.orderId, payment: captured(lo as any, 'pay_l') }), { result: 'paid' });
  assert.equal(await stockOf('a'), 2); assert.equal((await orderOf(late.orderId)).status, 'processing');

  // expired order, stock gone => on_hold + needsRefund, stock not driven negative
  const gone = await buy(fakeRazorpay(), [{ productId: 'b', quantity: 1, size: '40' }], 'u3', t0);
  await releaseExpiredOrders(db, new Date(t0.getTime() + 40 * 60_000));
  await db.collection('products').doc('b').update({ stock: 0 });
  const go = await orderOf(gone.orderId);
  assert.deepEqual(await applyCapturedPayment(db, { orderId: gone.orderId, payment: captured(go as any, 'pay_g') }), { result: 'paid_stock_unavailable' });
  const g = await orderOf(gone.orderId);
  assert.equal(g.status, 'on_hold'); assert.equal(g.needsRefund, true); assert.equal(await stockOf('b'), 0);
});

test('admin cancel restores stock once, even if called repeatedly; a second distinct payment is flagged for refund', async () => {
  const res = await buy(fakeRazorpay(), [{ productId: 'a', quantity: 2, size: '40' }]);
  const o = await orderOf(res.orderId);
  await applyCapturedPayment(db, { orderId: res.orderId, payment: captured(o as any, 'pay_1') });
  await applyCapturedPayment(db, { orderId: res.orderId, payment: captured(o as any, 'pay_2') });
  assert.equal((await orderOf(res.orderId)).needsRefund, true);
  assert.equal(await releaseOrderStock(db, res.orderId, 'cancelled_by_admin'), true);
  assert.equal(await releaseOrderStock(db, res.orderId, 'cancelled_by_admin'), false);
  assert.equal(await stockOf('a'), 5);
  assert.equal((await orderOf(res.orderId)).status, 'cancelled');
});

test('a user cannot hoard stock with unlimited unpaid orders', async () => {
  const rz = fakeRazorpay();
  await db.collection('products').doc('a').update({ stock: 100 });
  for (let i = 0; i < 5; i++) await buy(rz, [{ productId: 'a', quantity: 1, size: '40' }], 'hoarder');
  await assert.rejects(buy(rz, [{ productId: 'a', quantity: 1, size: '40' }], 'hoarder'), (e: any) => e.code === 'failed-precondition');
  await buy(rz, [{ productId: 'a', quantity: 1, size: '40' }], 'someone-else'); // other users unaffected
});

// ---------- shipping rule end to end ----------
test('default shipping rule: an order below Rs 7,499 is accepted with Rs 199 shipping added to the Razorpay amount', async () => {
  const rz = fakeRazorpay();
  const res = await createCheckoutOrder(db, rz, { uid: 'u1', lines: [{ productId: 'a', quantity: 2, size: '40' }], address });
  const o = await orderOf(res.orderId);
  assert.equal(o.subtotalAmount, 2000); assert.equal(o.shippingAmount, 199); assert.equal(o.totalAmount, 2199); assert.equal(o.amountPaise, 219900);
  assert.equal(rz.created[0].amount, 219900); assert.equal(await stockOf('a'), 3);
});
test('boundary: 7,498.99 pays Rs 199 shipping; 7,499.00 ships free (checked through the full order path)', async () => {
  await db.collection('products').doc('edge1').set({ name: 'Edge1', price: 7498.99, stock: 2 });
  await db.collection('products').doc('edge2').set({ name: 'Edge2', price: 7499, stock: 2 });
  const rz = fakeRazorpay();
  const r1 = await createCheckoutOrder(db, rz, { uid: 'u1', lines: [{ productId: 'edge1', quantity: 1, size: '40' }], address });
  const r2 = await createCheckoutOrder(db, rz, { uid: 'u1', lines: [{ productId: 'edge2', quantity: 1, size: '40' }], address });
  assert.equal(r1.amountPaise, 749899 + 19900); assert.equal((await orderOf(r1.orderId)).shippingAmount, 199);
  assert.equal(r2.amountPaise, 749900);         assert.equal((await orderOf(r2.orderId)).shippingAmount, 0);
});
test('with no fee configured, an order below the threshold is refused with no order, no stock change, no Razorpay call', async () => {
  const rz = fakeRazorpay();
  await assert.rejects(createCheckoutOrder(db, rz, { uid: 'u1', lines: [{ productId: 'a', quantity: 2, size: '40' }], address, shipping: { thresholdPaise: 749900, feeBelowThresholdPaise: null } }), (e: any) => e instanceof OrderError && e.code === 'failed-precondition');
  assert.equal(await stockOf('a'), 5); assert.equal((await db.collection('orders').get()).size, 0); assert.equal(rz.created.length, 0);
});
test('default shipping rule: Rs 7,499 or more ships free and Razorpay is asked for exactly the server total', async () => {
  await db.collection('products').doc('big').set({ name: 'Big', price: 7499, stock: 3 });
  const rz = fakeRazorpay();
  const res = await createCheckoutOrder(db, rz, { uid: 'u1', lines: [{ productId: 'big', quantity: 1, size: '40' }], address });
  const o = await orderOf(res.orderId);
  assert.equal(o.shippingAmount, 0); assert.equal(o.totalAmount, 7499); assert.equal(rz.created[0].amount, 749900);
});
test('a confirmed shipping fee below the threshold is added to the order and to the Razorpay amount', async () => {
  const rz = fakeRazorpay();
  const res = await buy(rz, [{ productId: 'a', quantity: 1, size: '40' }], 'u1', undefined, { thresholdPaise: 749900, feeBelowThresholdPaise: 5000 });
  const o = await orderOf(res.orderId);
  assert.equal(o.subtotalAmount, 1000); assert.equal(o.shippingAmount, 50); assert.equal(o.totalAmount, 1050); assert.equal(o.amountPaise, 105000);
  assert.equal(rz.created[0].amount, 105000);
});

// ---------- customer cancellation ----------
test('cancel: an unpaid order is cancelled by its owner immediately and stock is released once', async () => {
  const res = await buy(fakeRazorpay(), [{ productId: 'a', quantity: 2, size: '40' }], 'owner');
  assert.equal(await stockOf('a'), 3);
  assert.deepEqual(await requestCancellation(db, { uid: 'owner', orderId: res.orderId }), { outcome: 'cancelled' });
  assert.equal(await stockOf('a'), 5);
  const o = await orderOf(res.orderId);
  assert.equal(o.status, 'cancelled'); assert.equal(o.statusReason, 'cancelled_by_customer');
  await assert.rejects(requestCancellation(db, { uid: 'owner', orderId: res.orderId }), (e: any) => e.code === 'failed-precondition'); // not repeatable
  assert.equal(await stockOf('a'), 5);
});
test('cancel: only the owner can cancel; strangers get "not found"', async () => {
  const res = await buy(fakeRazorpay(), [{ productId: 'a', quantity: 1, size: '40' }], 'owner');
  await assert.rejects(requestCancellation(db, { uid: 'intruder', orderId: res.orderId }), (e: any) => e.code === 'not-found');
  assert.equal((await orderOf(res.orderId)).status, 'pending');
});
test('cancel: a paid order only gets a REQUEST (no automatic cancel, no stock change, no refund), within 24h', async () => {
  const t0 = new Date('2026-10-11T05:30:00Z');
  const res = await buy(fakeRazorpay(), [{ productId: 'a', quantity: 2, size: '40' }], 'owner', t0);
  const o0 = await orderOf(res.orderId);
  await applyCapturedPayment(db, { orderId: res.orderId, payment: captured(o0 as any) });
  const paidAt = new Date((await orderOf(res.orderId)).paidAt).getTime();
  assert.deepEqual(await requestCancellation(db, { uid: 'owner', orderId: res.orderId, reason: 'Ordered by mistake', now: new Date(paidAt + 3_600_000) }), { outcome: 'requested' });
  const o = await orderOf(res.orderId);
  assert.equal(o.status, 'processing'); assert.equal(o.paymentStatus, 'paid'); assert.equal(o.cancellationRequest.status, 'requested'); assert.equal(o.cancellationRequest.reason, 'Ordered by mistake');
  assert.equal(await stockOf('a'), 3); assert.ok(!o.needsRefund);
  await assert.rejects(requestCancellation(db, { uid: 'owner', orderId: res.orderId, now: new Date(paidAt + 7_200_000) }), (e: any) => e.code === 'failed-precondition'); // already requested
});
test('cancel: after 24h, or once packed/shipped, a paid order cannot be cancelled online', async () => {
  const res = await buy(fakeRazorpay(), [{ productId: 'a', quantity: 1, size: '40' }], 'owner');
  const o0 = await orderOf(res.orderId);
  await applyCapturedPayment(db, { orderId: res.orderId, payment: captured(o0 as any) });
  const paidAt = new Date((await orderOf(res.orderId)).paidAt).getTime();
  await assert.rejects(requestCancellation(db, { uid: 'owner', orderId: res.orderId, now: new Date(paidAt + 25 * 3_600_000) }), (e: any) => e.code === 'failed-precondition');
  await db.collection('orders').doc(res.orderId).update({ status: 'packed' });
  await assert.rejects(requestCancellation(db, { uid: 'owner', orderId: res.orderId, now: new Date(paidAt + 3_600_000) }), (e: any) => e.code === 'failed-precondition');
});
test('cancel: a payment that lands AFTER the customer cancelled is recorded and flagged for refund, never revived', async () => {
  const res = await buy(fakeRazorpay(), [{ productId: 'a', quantity: 2, size: '40' }], 'owner');
  await requestCancellation(db, { uid: 'owner', orderId: res.orderId });
  const o0 = await orderOf(res.orderId);
  const out = await applyCapturedPayment(db, { orderId: res.orderId, payment: captured(o0 as any, 'pay_late') });
  assert.deepEqual(out, { result: 'paid_order_cancelled' });
  const o = await orderOf(res.orderId);
  assert.equal(o.status, 'cancelled'); assert.equal(o.paymentStatus, 'paid'); assert.equal(o.needsRefund, true); assert.equal(o.statusReason, 'paid_after_cancellation');
  assert.equal(await stockOf('a'), 5); // stock stays released
});
test('admin cancelling a PAID order restores stock once and flags it for a manual refund', async () => {
  const res = await buy(fakeRazorpay(), [{ productId: 'a', quantity: 2, size: '40' }]);
  const o0 = await orderOf(res.orderId);
  await applyCapturedPayment(db, { orderId: res.orderId, payment: captured(o0 as any) });
  assert.equal(await releaseOrderStock(db, res.orderId, 'cancelled_by_admin'), true);
  const o = await orderOf(res.orderId);
  assert.equal(o.status, 'cancelled'); assert.equal(o.needsRefund, true); assert.equal(await stockOf('a'), 5);
});


// ---------- webhook ----------
const WH_SECRET = 'whsec_test';
function hook(event: string, payment: any, o: { eventId?: string | undefined; secret?: string; tamper?: boolean } = {}) {
  const body = { event, payload: { payment: { entity: payment } } };
  const raw = Buffer.from(JSON.stringify(body));
  const sig = createHmac('sha256', o.secret ?? WH_SECRET).update(o.tamper ? Buffer.from('x' + raw.toString()) : raw).digest('hex');
  return processWebhook(db, { rawBody: raw, signature: sig, eventId: 'eventId' in o ? o.eventId : `evt_${Math.random()}`, body, secret: WH_SECRET });
}
async function mkOrder() {
  const res = await buy(fakeRazorpay(), [{ productId: 'a', quantity: 1, size: '40' }]);
  return { res, o: await orderOf(res.orderId) as any };
}

test('webhook: bad signature or missing event id is rejected and changes nothing', async () => {
  const { res, o } = await mkOrder();
  assert.equal((await hook('payment.captured', captured(o), { secret: 'wrong' })).status, 400);
  assert.equal((await hook('payment.captured', captured(o), { tamper: true })).status, 400);
  assert.equal((await hook('payment.captured', captured(o), { eventId: undefined })).status, 400);
  assert.equal((await orderOf(res.orderId)).paymentStatus, 'pending');
});
test('webhook: captured => paid once; duplicate event id is a no-op', async () => {
  const { res, o } = await mkOrder();
  assert.deepEqual((await hook('payment.captured', captured(o), { eventId: 'e1' })).body, { ok: true, result: 'paid' });
  assert.deepEqual((await hook('payment.captured', captured(o), { eventId: 'e1' })).body, { ok: true, result: 'duplicate_event' });
  const a = await orderOf(res.orderId); assert.equal(a.paymentStatus, 'paid'); assert.equal(a.status, 'processing');
  assert.equal(await stockOf('a'), 4);
});
test('webhook: amount mismatch and failed/authorized payments are never marked paid', async () => {
  const { res, o } = await mkOrder();
  const r1 = await hook('payment.captured', { ...captured(o), amount: 1 });
  assert.equal(r1.status, 200); assert.equal((r1.body as any).ok, false);
  const r2 = await hook('payment.captured', { ...captured(o), status: 'authorized' });
  assert.equal((r2.body as any).ok, false);
  const r3 = await hook('payment.failed', { id: 'pay_x', order_id: o.razorpayOrderId, error_code: 'BAD' });
  assert.deepEqual(r3.body, { ok: true, result: 'recorded' });
  const a = await orderOf(res.orderId); assert.equal(a.paymentStatus, 'pending'); assert.equal(a.lastPaymentError, 'BAD');
  assert.equal(await stockOf('a'), 4);
});

// ---------- order e-mail queue ----------
test('paid order queues one customer mail (+owner if configured); unpaid/failed queue none; replays add none', async () => {
  const { res, o } = await mkOrder();
  assert.equal((await db.collection('mail').get()).size, 0);
  await hook('payment.failed', { id: 'pay_f', order_id: o.razorpayOrderId, error_code: 'X' });
  assert.equal((await db.collection('mail').get()).size, 0);
  await applyCapturedPayment(db, { orderId: res.orderId, payment: captured(o), ownerNotifyEmail: 'owner@example.com' });
  await applyCapturedPayment(db, { orderId: res.orderId, payment: captured(o), ownerNotifyEmail: 'owner@example.com' });
  const ids = (await db.collection('mail').get()).docs.map((d: any) => d.id).sort();
  assert.deepEqual(ids, [`order-${res.orderId}-customer`, `order-${res.orderId}-owner`]);
  const m = (await db.collection('mail').doc(`order-${res.orderId}-customer`).get()).data()!;
  assert.equal(m.to, 'a@b.com'); assert.match(m.message.html, /Fabric A/); assert.match(m.message.html, /not a GST tax invoice/);
});
test('mail builder escapes HTML, skips invalid addresses', () => {
  const docs = buildMailDocs('o1', { userName: '<script>x</script>', userEmail: 'bad address', items: [{ name: '<b>x</b>', quantity: 1, price: 10 }], totalAmount: 10 }, 'not-an-email');
  assert.equal(docs.length, 0);
  const c = buildCustomerEmail('o1', { userName: '<script>x</script>', items: [{ name: '<img onerror=1>', quantity: 1, price: 10 }], totalAmount: 10 });
  assert.doesNotMatch(c.html, /<script>|<img/);
});

// ---------- idempotent checkout ----------
test('same user + same requestId returns the SAME order: one order, one reservation, one Razorpay order', async () => {
  const rz = fakeRazorpay();
  const mk = () => createCheckoutOrder(db, rz, { uid: 'u1', lines: [{ productId: 'a', quantity: 2, size: '40' }], address, shipping: NO_RULE, requestId: 'req-12345678' });
  const [r1, r2] = await Promise.all([mk(), mk()]);
  const again = await mk();
  assert.equal(r1.orderId, r2.orderId); assert.equal(r1.orderId, again.orderId);
  assert.equal(r1.razorpayOrderId, again.razorpayOrderId);
  assert.equal((await db.collection('orders').get()).size, 1);
  assert.equal(await stockOf('a'), 3);          // reserved once (5 - 2)
  assert.equal(rz.created.length, 1);           // one payment order
});
test('different users cannot collide on a requestId; a processed order is not resumed', async () => {
  const rz = fakeRazorpay();
  const a = await createCheckoutOrder(db, rz, { uid: 'u1', lines: [{ productId: 'a', quantity: 1, size: '40' }], address, shipping: NO_RULE, requestId: 'shared-key-1' });
  const b = await createCheckoutOrder(db, rz, { uid: 'u2', lines: [{ productId: 'a', quantity: 1, size: '40' }], address, shipping: NO_RULE, requestId: 'shared-key-1' });
  assert.notEqual(a.orderId, b.orderId);
  await applyCapturedPayment(db, { orderId: a.orderId, payment: captured({ razorpayOrderId: a.razorpayOrderId, amountPaise: a.amountPaise }) });
  await assert.rejects(createCheckoutOrder(db, rz, { uid: 'u1', lines: [{ productId: 'a', quantity: 1, size: '40' }], address, shipping: NO_RULE, requestId: 'shared-key-1' }), /already been processed/);
  // a malformed key is ignored (normal, non-idempotent order), never trusted as a document id
  const odd = await createCheckoutOrder(db, rz, { uid: 'u1', lines: [{ productId: 'a', quantity: 1, size: '40' }], address, shipping: NO_RULE, requestId: 'bad/key!' });
  assert.ok(!odd.orderId.includes('bad'));
});

// ---------- returns ----------
test('return request: owner only, delivered + within 7 days, once; no refund flag, stock untouched', async () => {
  const res = await buy(fakeRazorpay(), [{ productId: 'a', quantity: 1, size: '40' }]);
  const o0 = await orderOf(res.orderId);
  await applyCapturedPayment(db, { orderId: res.orderId, payment: captured(o0 as any) });
  const ref = db.collection('orders').doc(res.orderId);
  const t = new Date('2026-10-11T10:00:00.000Z');
  await assert.rejects(requestReturn(db, { uid: 'u1', orderId: res.orderId, now: t }), /only after your order has been delivered/);
  await ref.update({ status: 'delivered', statusHistory: [{ status: 'delivered', timestamp: t.toISOString() }] });
  await assert.rejects(requestReturn(db, { uid: 'someone-else', orderId: res.orderId, now: t }), /Order not found/);
  const late = new Date(t.getTime() + 8 * 86_400_000);
  await assert.rejects(requestReturn(db, { uid: 'u1', orderId: res.orderId, now: late }), /within 7 days of delivery/);
  const stockBefore = await stockOf('a');
  assert.deepEqual(await requestReturn(db, { uid: 'u1', orderId: res.orderId, reason: 'wrong colour', now: new Date(t.getTime() + 2 * 86_400_000) }), { outcome: 'requested' });
  const after = await orderOf(res.orderId) as any;
  assert.equal(after.returnRequest.status, 'requested'); assert.equal(after.returnRequest.reason, 'wrong colour');
  assert.notEqual(after.needsRefund, true); assert.equal(after.status, 'delivered'); assert.equal(await stockOf('a'), stockBefore);
  await assert.rejects(requestReturn(db, { uid: 'u1', orderId: res.orderId, now: t }), /already been requested/);
});

// ---------- client/server total agreement ----------
test('expectedTotalPaise: matching total proceeds; a stale/wrong total is refused BEFORE anything is reserved or created', async () => {
  const lines = [{ productId: 'a', quantity: 2, size: '40' }]; // 2 x Rs 1,000 = Rs 2,000
  const rz = fakeRazorpay();
  const ok = await createCheckoutOrder(db, rz, { uid: 'u1', lines, address, shipping: NO_RULE, expectedTotalPaise: 200000 });
  assert.equal(ok.amountPaise, 200000);
  assert.equal(await stockOf('a'), 3);

  const orderCount = (await db.collection('orders').get()).size;
  const stockBefore = await stockOf('a');
  const created = rz.created.length;
  // price changed under the customer (server says 2,000, customer saw 1,800), or they forgot shipping, or sent junk
  for (const wrong of [180000, 199999, 200001, 1]) {
    await assert.rejects(createCheckoutOrder(db, rz, { uid: 'u2', lines, address, shipping: NO_RULE, expectedTotalPaise: wrong }), /price or shipping .* changed/i);
  }
  assert.equal((await db.collection('orders').get()).size, orderCount); // no order
  assert.equal(await stockOf('a'), stockBefore);                        // no reservation
  assert.equal(rz.created.length, created);                              // no Razorpay order
});
test('expectedTotalPaise includes the real shipping rule (Rs 199 below Rs 7,499)', async () => {
  const lines = [{ productId: 'a', quantity: 1, size: '40' }]; // Rs 1,000 -> total Rs 1,199 with default rule
  const rz = fakeRazorpay();
  await assert.rejects(createCheckoutOrder(db, rz, { uid: 'u1', lines, address, expectedTotalPaise: 100000 }), /changed/i); // subtotal only
  const ok = await createCheckoutOrder(db, rz, { uid: 'u1', lines, address, expectedTotalPaise: 119900 });
  assert.equal(ok.amountPaise, 119900);
});
test('expectedTotalPaise on a retry (same requestId): a changed total is refused, the same total returns the same order', async () => {
  const lines = [{ productId: 'a', quantity: 1, size: '40' }];
  const rz = fakeRazorpay();
  const first = await createCheckoutOrder(db, rz, { uid: 'u1', lines, address, shipping: NO_RULE, requestId: 'retry-key-1', expectedTotalPaise: 100000 });
  const same = await createCheckoutOrder(db, rz, { uid: 'u1', lines, address, shipping: NO_RULE, requestId: 'retry-key-1', expectedTotalPaise: 100000 });
  assert.equal(same.orderId, first.orderId);
  await assert.rejects(createCheckoutOrder(db, rz, { uid: 'u1', lines, address, shipping: NO_RULE, requestId: 'retry-key-1', expectedTotalPaise: 90000 }), /changed/i);
});

// ---------- cancellation / expiry / payment races ----------
const ITER = 6;
const mkPending = async (uid = 'u1') => {
  await db.collection('products').doc('a').update({ stock: 5 }); // each iteration starts from a clean shelf
  const res = await buy(fakeRazorpay(), [{ productId: 'a', quantity: 1, size: '40' }], uid);
  const o = await orderOf(res.orderId) as any;
  return { id: res.orderId, o, payment: captured(o) };
};

test('automatic releases never cancel a PAID order (stale-view guard): onlyIfUnpaid', async () => {
  const { id, payment } = await mkPending();
  await applyCapturedPayment(db, { orderId: id, payment });
  const stock = await stockOf('a');
  assert.equal(await releaseOrderStock(db, id, 'payment_window_elapsed', { onlyIfUnpaid: true }), false);
  const o = await orderOf(id) as any;
  assert.equal(o.status, 'processing'); assert.equal(o.paymentStatus, 'paid'); assert.notEqual(o.needsRefund, true);
  assert.equal(await stockOf('a'), stock);
  // a staff cancel (no flag) still works on a paid order and flags the refund
  assert.equal(await releaseOrderStock(db, id, 'cancelled_by_admin'), true);
  assert.equal((await orderOf(id) as any).needsRefund, true);
});

test('race: expiry sweep vs payment landing at the same moment never cancels or double-reserves a paid order', async () => {
  for (let i = 0; i < ITER; i++) {
    const { id, payment } = await mkPending(`sw${i}`);
    const before = await stockOf('a');
    const far = new Date(Date.now() + 120 * 60_000);
    const r = await Promise.allSettled([applyCapturedPayment(db, { orderId: id, payment }), releaseExpiredOrders(db, far)]);
    assert.ok(r.every((x) => x.status === 'fulfilled'), `iteration ${i}: ${JSON.stringify(r)}`);
    const o = await orderOf(id) as any;
    assert.equal(o.status, 'processing', `iteration ${i}`); assert.equal(o.paymentStatus, 'paid');
    assert.notEqual(o.needsRefund, true); assert.equal(o.stockReserved, true); assert.equal(o.stockReleased, false);
    assert.equal(await stockOf('a'), before, `iteration ${i}: stock must equal the single reservation`);
  }
});

test('race: admin cancel vs payment: always ends cancelled + paid + refund-flagged, stock restored exactly once', async () => {
  for (let i = 0; i < ITER; i++) {
    const { id, payment } = await mkPending(`ad${i}`);
    const before = await stockOf('a');
    const r = await Promise.allSettled([applyCapturedPayment(db, { orderId: id, payment }), releaseOrderStock(db, id, 'cancelled_by_admin')]);
    assert.ok(r.every((x) => x.status === 'fulfilled'), `iteration ${i}: ${JSON.stringify(r)}`);
    const o = await orderOf(id) as any;
    assert.equal(o.status, 'cancelled', `iteration ${i}`); assert.equal(o.paymentStatus, 'paid'); assert.equal(o.needsRefund, true);
    assert.equal(await stockOf('a'), before + 1, `iteration ${i}: restored exactly once`);
  }
});

test('race: customer cancel vs payment: either cancelled+refund-flagged (stock back once) or paid+cancellation REQUEST (stock kept)', async () => {
  for (let i = 0; i < ITER; i++) {
    const { id, payment } = await mkPending(`cu${i}`);
    const before = await stockOf('a');
    const r = await Promise.allSettled([applyCapturedPayment(db, { orderId: id, payment }), requestCancellation(db, { uid: `cu${i}`, orderId: id })]);
    assert.ok(r.every((x) => x.status === 'fulfilled'), `iteration ${i}: ${JSON.stringify(r)}`);
    const o = await orderOf(id) as any; const stock = await stockOf('a');
    const cancelledPath = o.status === 'cancelled' && o.paymentStatus === 'paid' && o.needsRefund === true && stock === before + 1;
    const requestPath = o.status === 'processing' && o.paymentStatus === 'paid' && !!o.cancellationRequest && stock === before && o.needsRefund !== true;
    assert.ok(cancelledPath || requestPath, `iteration ${i}: inconsistent state ${JSON.stringify({ s: o.status, p: o.paymentStatus, nr: o.needsRefund, cr: !!o.cancellationRequest, stock, before })}`);
  }
});

test('race: several simultaneous cancels/sweeps of one unpaid order restore its stock exactly once', async () => {
  for (let i = 0; i < ITER; i++) {
    const { id } = await mkPending(`mu${i}`);
    const before = await stockOf('a');
    const far = new Date(Date.now() + 120 * 60_000);
    const r = await Promise.allSettled([
      releaseOrderStock(db, id, 'cancelled_by_admin'), releaseOrderStock(db, id, 'cancelled_by_admin'),
      requestCancellation(db, { uid: `mu${i}`, orderId: id }), releaseExpiredOrders(db, far),
    ]);
    // a losing cancel may be refused ("already cancelled"); what matters is the end state
    assert.ok(r.every((x) => x.status === 'fulfilled' || /cancel|Order/i.test(String((x as any).reason?.message))), `iteration ${i}: ${JSON.stringify(r.map(x => x.status))}`);
    assert.equal((await orderOf(id) as any).status, 'cancelled');
    assert.equal(await stockOf('a'), before + 1, `iteration ${i}: exactly once`);
  }
});

test('retries: duplicate verification, duplicate webhook event ids and a second event for the same payment change nothing', async () => {
  const { id, payment } = await mkPending('rt1');
  const after1 = await applyCapturedPayment(db, { orderId: id, payment, eventId: 'evt_A' });
  assert.equal(after1.result, 'paid');
  const stock = await stockOf('a'); const mails = (await db.collection('mail').get()).size;
  assert.equal((await applyCapturedPayment(db, { orderId: id, payment, eventId: 'evt_A' })).result, 'duplicate_event');
  assert.equal((await applyCapturedPayment(db, { orderId: id, payment, eventId: 'evt_B' })).result, 'already_paid');   // order.paid after payment.captured
  assert.equal((await applyCapturedPayment(db, { orderId: id, payment })).result, 'already_paid');                      // client verify afterwards
  assert.equal(await stockOf('a'), stock);
  assert.equal((await db.collection('mail').get()).size, mails);
  assert.notEqual((await orderOf(id) as any).needsRefund, true);
});

test('webhook: a signed captured event WITHOUT an order id is acknowledged (not retried forever) and marks nothing paid', async () => {
  const { id } = await mkPending('wh_noorder');
  const r = await hook('payment.captured', { id: 'pay_orphan', status: 'captured', amount: 100000, currency: 'INR' }); // no order_id
  assert.equal(r.status, 200);
  assert.equal((r.body as any).ok, false); assert.equal((r.body as any).error, 'invalid-argument');
  assert.equal((await orderOf(id) as any).paymentStatus, 'pending');
});
