// Pure payment logic: server-side totals, signatures, auth gate. No network / no emulator.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import * as coreNs from '../functions/src/core';
// functions/ is CommonJS; unwrap the interop default when present.
const core: typeof coreNs = (coreNs as any).default ?? coreNs;
const {
  ALLOWED_SIZES, OrderError, assertPaymentMatchesOrder, assertPhoneAuth, computeOrderTotals,
  validateShippingAddress, verifyPaymentSignature, verifyWebhookSignature, MAX_LINES,
  computeShippingPaise, evaluateCancellation, evaluateReturn, RETURN_WINDOW_DAYS, DEFAULT_SHIPPING, FREE_SHIPPING_THRESHOLD_PAISE, SHIPPING_FEE_BELOW_THRESHOLD_PAISE,
} = core;

// Arithmetic tests below are about prices/quantities, not the shipping rule, so they opt out of it explicitly.
const NO_RULE = { thresholdPaise: 0, feeBelowThresholdPaise: 0 };

const P = (id: string, price: number, stock = 10, extra: object = {}) => ({ id, name: `P ${id}`, price, stock, ...extra });
const catalogue = { a: P('a', 1000), b: P('b', 1999.99, 5), hidden: P('hidden', 500, 5, { visibility: 'hidden' }), free: P('free', 0), nostock: { id: 'nostock', name: 'N', price: 10 } as any };
const line = (productId: any, quantity: any, size: any = '40', extra: object = {}) => ({ productId, quantity, size, ...extra });

const fails = (fn: () => unknown, code?: string) =>
  assert.throws(fn, (e: any) => e instanceof OrderError && (!code || e.code === code));

// ---------- server-side total calculation ----------
test('totals are computed from catalogue prices; client-supplied price/total/currency are ignored', () => {
  const t = computeOrderTotals([line('a', 2, '40', { price: 1, total: 1, unitPricePaise: 1 })], catalogue, NO_RULE);
  assert.equal(t.subtotalPaise, 200000);
  assert.equal(t.shippingPaise, 0);
  assert.equal(t.totalPaise, 200000);
  assert.equal(t.items[0].unitPricePaise, 100000);
});
test('decimal prices round to whole paise per unit', () => {
  const t = computeOrderTotals([line('b', 3)], catalogue, NO_RULE);
  assert.equal(t.items[0].unitPricePaise, 199999);
  assert.equal(t.totalPaise, 599997);
});
test('same product+size merges; stock is checked across sizes of the same product', () => {
  const t = computeOrderTotals([line('a', 2, '40'), line('a', 3, '40')], catalogue, NO_RULE);
  assert.equal(t.items.length, 1);
  assert.equal(t.items[0].quantity, 5);
  fails(() => computeOrderTotals([line('b', 3, '40'), line('b', 3, '42')], catalogue), 'failed-precondition'); // 6 > stock 5
});
test('rejects empty/oversized carts and bad ids, quantities, sizes', () => {
  fails(() => computeOrderTotals([], catalogue), 'invalid-argument');
  fails(() => computeOrderTotals(null, catalogue), 'invalid-argument');
  fails(() => computeOrderTotals(Array.from({ length: MAX_LINES + 1 }, () => line('a', 1)), catalogue), 'invalid-argument');
  fails(() => computeOrderTotals([line('', 1)], catalogue), 'invalid-argument');
  fails(() => computeOrderTotals([line('a/b', 1)], catalogue), 'invalid-argument');
  for (const q of [0, -1, 1.5, '2', 11, NaN, null]) fails(() => computeOrderTotals([line('a', q)], catalogue), 'invalid-argument');
  for (const s of ['39', '', 'XL', 40]) fails(() => computeOrderTotals([line('a', 1, s)], catalogue), 'invalid-argument');
  fails(() => computeOrderTotals([{ productId: 'a', quantity: 1 }], catalogue), 'invalid-argument'); // size missing
  assert.ok(ALLOWED_SIZES.includes('40'));
});
test('unknown, hidden, zero-price and stock-less products cannot be bought', () => {
  fails(() => computeOrderTotals([line('missing', 1)], catalogue), 'failed-precondition');
  fails(() => computeOrderTotals([line('hidden', 1)], catalogue), 'failed-precondition');
  fails(() => computeOrderTotals([line('free', 1)], catalogue), 'failed-precondition');
  fails(() => computeOrderTotals([line('nostock', 1)], catalogue), 'failed-precondition');
  fails(() => computeOrderTotals([line('a', 1)], { a: P('a', NaN) }), 'failed-precondition');
  fails(() => computeOrderTotals([line('a', 1)], { a: P('a', -5) }), 'failed-precondition');
  fails(() => computeOrderTotals([line('a', 11)], { a: P('a', 10, 100) }), 'invalid-argument');
});
test('insufficient stock is refused (no placeholder default stock)', () => {
  fails(() => computeOrderTotals([line('a', 4)], { a: P('a', 10, 3) }), 'failed-precondition');
  fails(() => computeOrderTotals([line('a', 1)], { a: P('a', 10, 0) }), 'failed-precondition');
});

// ---------- authentication gate ----------
test('ordering requires a VERIFIED PHONE on the server: phone OTP or Google+linked phone; never guest, anonymous or Google-only', () => {
  const tok = (o: object) => ({ uid: 'u', token: o });
  fails(() => assertPhoneAuth(null), 'unauthenticated');
  fails(() => assertPhoneAuth(undefined), 'unauthenticated');
  fails(() => assertPhoneAuth({ uid: '', token: { phone_number: '+919876543210' } }), 'unauthenticated');
  fails(() => assertPhoneAuth(tok({ firebase: { sign_in_provider: 'anonymous' } })), 'unauthenticated');
  fails(() => assertPhoneAuth(tok({ firebase: { sign_in_provider: 'anonymous' }, phone_number: '+919876543210' })), 'unauthenticated');
  fails(() => assertPhoneAuth(tok({ firebase: { sign_in_provider: 'google.com' }, email: 'a@b.com' })), 'unauthenticated'); // Google only: no phone
  fails(() => assertPhoneAuth(tok({ firebase: { sign_in_provider: 'google.com' }, phone_number: '' })), 'unauthenticated');
  fails(() => assertPhoneAuth(tok({ firebase: { sign_in_provider: 'google.com' }, phone_number: 12345 })), 'unauthenticated');
  fails(() => assertPhoneAuth(tok({})), 'unauthenticated');
  assert.equal(assertPhoneAuth({ uid: 'u1', token: { firebase: { sign_in_provider: 'phone' }, phone_number: '+919876543210' } }), 'u1');
  assert.equal(assertPhoneAuth({ uid: 'u2', token: { firebase: { sign_in_provider: 'google.com', identities: { phone: ['+919876543210'] } }, phone_number: '+919876543210' } }), 'u2'); // Google + linked phone
});

// ---------- signatures ----------
const hmac = (secret: string, data: string | Buffer) => crypto.createHmac('sha256', secret).update(data).digest('hex');
test('payment signature: valid, tampered ids, wrong secret, empty secret, malformed', () => {
  const sig = hmac('sek', 'order_1|pay_1');
  assert.equal(verifyPaymentSignature('order_1', 'pay_1', sig, 'sek'), true);
  assert.equal(verifyPaymentSignature('order_2', 'pay_1', sig, 'sek'), false);
  assert.equal(verifyPaymentSignature('order_1', 'pay_2', sig, 'sek'), false);
  assert.equal(verifyPaymentSignature('order_1', 'pay_1', sig, 'other'), false);
  assert.equal(verifyPaymentSignature('order_1', 'pay_1', hmac('', 'order_1|pay_1'), ''), false); // empty secret never validates
  assert.equal(verifyPaymentSignature('order_1', 'pay_1', 'short', 'sek'), false); // no throw on length mismatch
  assert.equal(verifyPaymentSignature('order_1', 'pay_1', undefined as any, 'sek'), false);
  assert.equal(verifyPaymentSignature('', 'pay_1', sig, 'sek'), false);
});
test('webhook signature: valid, tampered body, wrong secret, UNSET secret rejected, bad header types', () => {
  const body = Buffer.from('{"event":"payment.captured"}');
  const sig = hmac('whsec', body);
  assert.equal(verifyWebhookSignature(body, sig, 'whsec'), true);
  assert.equal(verifyWebhookSignature(Buffer.from('{"event":"payment.captured "}'), sig, 'whsec'), false);
  assert.equal(verifyWebhookSignature(body, sig, 'nope'), false);
  assert.equal(verifyWebhookSignature(body, hmac('', body), ''), false); // forged with the empty key
  assert.equal(verifyWebhookSignature(body, undefined, 'whsec'), false);
  assert.equal(verifyWebhookSignature(body, ['x'] as any, 'whsec'), false);
  assert.equal(verifyWebhookSignature(body, 'abc', 'whsec'), false);
});

// ---------- captured payment vs order ----------
const order = { razorpayOrderId: 'order_1', amountPaise: 150000, currency: 'INR' };
const pay = (o: object = {}) => ({ id: 'pay_1', order_id: 'order_1', status: 'captured', amount: 150000, currency: 'INR', ...o });
test('payment must be captured and match order id, amount and currency', () => {
  assertPaymentMatchesOrder(pay(), order);
  fails(() => assertPaymentMatchesOrder(pay({ status: 'authorized' }), order), 'failed-precondition');
  fails(() => assertPaymentMatchesOrder(pay({ status: 'failed' }), order), 'failed-precondition');
  fails(() => assertPaymentMatchesOrder(pay({ order_id: 'order_2' }), order), 'permission-denied');
  fails(() => assertPaymentMatchesOrder(pay({ amount: 100 }), order), 'permission-denied');
  fails(() => assertPaymentMatchesOrder(pay({ currency: 'USD' }), order), 'permission-denied');
  fails(() => assertPaymentMatchesOrder(pay(), { ...order, razorpayOrderId: undefined }), 'permission-denied');
});

// ---------- shipping address ----------
test('shipping address validation', () => {
  const ok = { fullName: ' A B ', email: 'A@B.com', phone: '9876543210', addressLine1: 'x', city: 'c', state: 'Delhi', postalCode: '110001' };
  const v = validateShippingAddress(ok);
  assert.equal(v.fullName, 'A B'); assert.equal(v.email, 'a@b.com'); assert.equal(v.country, 'India');
  for (const bad of [{ phone: '1234567890' }, { phone: '98765' }, { postalCode: '12' }, { state: 'Nowhere' }, { email: 'x' }, { fullName: '' }, { city: '' }, { addressLine1: '' }]) {
    fails(() => validateShippingAddress({ ...ok, ...bad }), 'invalid-argument');
  }
  fails(() => validateShippingAddress(undefined), 'invalid-argument');
});

// ---------- shipping rule: free from Rs 7,499; below that the fee is NOT confirmed ----------
test('shipping: free at or above Rs 7,499; threshold constant is exactly 7,499 rupees', () => {
  assert.equal(FREE_SHIPPING_THRESHOLD_PAISE, 749900);
  assert.equal(computeShippingPaise(749900), 0);
  assert.equal(computeShippingPaise(1_000_000), 0);
});
test('shipping: Rs 199 applies below Rs 7,499 (boundary: 7,498.99 pays, 7,499.00 is free)', () => {
  assert.equal(SHIPPING_FEE_BELOW_THRESHOLD_PAISE, 19900);
  assert.equal(DEFAULT_SHIPPING.feeBelowThresholdPaise, 19900);
  assert.equal(computeShippingPaise(749899), 19900); // 1 paisa short
  assert.equal(computeShippingPaise(1), 19900);
  assert.equal(computeShippingPaise(749900), 0);     // exactly 7,499.00
  const short = computeOrderTotals([line('a', 1)], { a: P('a', 7498.99) });
  assert.equal(short.subtotalPaise, 749899); assert.equal(short.shippingPaise, 19900); assert.equal(short.totalPaise, 769799);
  const exact = computeOrderTotals([line('a', 1)], { a: P('a', 7499) });
  assert.equal(exact.subtotalPaise, 749900); assert.equal(exact.shippingPaise, 0); assert.equal(exact.totalPaise, 749900);
  const small = computeOrderTotals([line('a', 2)], { a: P('a', 1000) });
  assert.equal(small.totalPaise, 200000 + 19900);
});
test('shipping: with no fee configured, orders below the threshold are refused (safety net, not the live setting)', () => {
  const noFee = { thresholdPaise: 749900, feeBelowThresholdPaise: null };
  fails(() => computeShippingPaise(749899, noFee), 'failed-precondition');
  assert.equal(computeShippingPaise(749900, noFee), 0);
});
test('shipping: once a fee is configured it is added only below the threshold', () => {
  const cfg = { thresholdPaise: 749900, feeBelowThresholdPaise: 5000 };
  const small = computeOrderTotals([line('a', 1)], { a: P('a', 2000) }, cfg);
  assert.equal(small.shippingPaise, 5000); assert.equal(small.totalPaise, 205000);
  const big = computeOrderTotals([line('a', 1)], { a: P('a', 8000) }, cfg);
  assert.equal(big.shippingPaise, 0); assert.equal(big.totalPaise, 800000);
});

// ---------- customer cancellation rules ----------
const T0 = new Date('2026-10-11T05:30:00.000Z');
const hoursAfter = (h: number) => new Date(T0.getTime() + h * 3_600_000);
const paidOrder = (o: object = {}) => ({ status: 'processing', paymentStatus: 'paid', createdAt: T0.toISOString(), paidAt: T0.toISOString(), ...o });
test('cancellation: unpaid pending orders cancel immediately', () => {
  assert.deepEqual(evaluateCancellation({ status: 'pending', paymentStatus: 'pending', createdAt: T0.toISOString() }, hoursAfter(0.2)), { allowed: true, mode: 'cancel_unpaid' });
});
test('cancellation: paid + processing is a REQUEST, only within 24 hours', () => {
  assert.deepEqual(evaluateCancellation(paidOrder(), hoursAfter(1)), { allowed: true, mode: 'request' });
  assert.deepEqual(evaluateCancellation(paidOrder(), hoursAfter(24)), { allowed: true, mode: 'request' }); // boundary is inclusive
  assert.equal(evaluateCancellation(paidOrder(), hoursAfter(24.01)).allowed, false);
  assert.equal(evaluateCancellation(paidOrder({ createdAt: hoursAfter(-100).toISOString() }), hoursAfter(1)).allowed, true); // window counts from payment
});
test('cancellation: unsafe states are refused (packed, shipped, delivered, held, tracked, cancelled, already requested)', () => {
  for (const status of ['packed', 'shipped', 'delivered', 'returned', 'failed_delivery', 'on_hold', 'cancelled']) {
    assert.equal(evaluateCancellation(paidOrder({ status }), hoursAfter(1)).allowed, false, status);
  }
  assert.equal(evaluateCancellation(paidOrder({ trackingId: 'DTDC123' }), hoursAfter(1)).allowed, false);
  assert.equal(evaluateCancellation(paidOrder({ cancellationRequest: { status: 'requested' } }), hoursAfter(1)).allowed, false);
  assert.equal(evaluateCancellation({ status: 'pending', paymentStatus: 'failed', createdAt: T0.toISOString() }, hoursAfter(1)).allowed, false);
  assert.equal(evaluateCancellation({ status: 'processing', paymentStatus: 'pending', createdAt: T0.toISOString() }, hoursAfter(1)).allowed, false);
  assert.equal(evaluateCancellation(paidOrder({ paidAt: 'garbage', createdAt: 'garbage' }), hoursAfter(1)).allowed, false);
});

// ---------- returns: 7 days from DELIVERY ----------
const DELIVERED = new Date('2026-10-11T10:00:00.000Z');
const deliveredOrder = (extra: any = {}) => ({ status: 'delivered', paymentStatus: 'paid', statusHistory: [{ status: 'shipped', timestamp: '2026-10-09T10:00:00.000Z' }, { status: 'delivered', timestamp: DELIVERED.toISOString() }], ...extra });
const daysAfterDelivery = (d: number) => new Date(DELIVERED.getTime() + d * 86_400_000);
test('returns: allowed within 7 days of delivery, refused after (boundary exact)', () => {
  assert.equal(RETURN_WINDOW_DAYS, 7);
  assert.equal(evaluateReturn(deliveredOrder(), daysAfterDelivery(0.5)).allowed, true);
  assert.equal(evaluateReturn(deliveredOrder(), daysAfterDelivery(7)).allowed, true);
  const late = evaluateReturn(deliveredOrder(), new Date(daysAfterDelivery(7).getTime() + 1));
  assert.equal(late.allowed, false); assert.match(late.reason!, /within 7 days of delivery/);
});
test('returns: not before delivery, not unpaid, not twice, needs a delivery timestamp', () => {
  assert.equal(evaluateReturn(deliveredOrder({ status: 'shipped' }), daysAfterDelivery(1)).allowed, false);
  assert.equal(evaluateReturn(deliveredOrder({ paymentStatus: 'pending' }), daysAfterDelivery(1)).allowed, false);
  assert.equal(evaluateReturn(deliveredOrder({ returnRequest: { status: 'requested' } }), daysAfterDelivery(1)).allowed, false);
  assert.equal(evaluateReturn(deliveredOrder({ statusHistory: [] }), daysAfterDelivery(1)).allowed, false);
  assert.equal(evaluateReturn(deliveredOrder({ statusHistory: [{ status: 'delivered', timestamp: 'garbage' }] }), daysAfterDelivery(1)).allowed, false);
});
