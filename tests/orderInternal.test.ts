// Staff-only order data must never live on the customer-readable order document (Firestore cannot hide single fields).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as oiNs from '../src/utils/orderInternal';
import * as trackNs from '../src/utils/trackingEvents';
import * as fnOrdersNs from '../functions/src/orders';
const OI: any = (oiNs as any).default ?? oiNs;
const T: any = (trackNs as any).default ?? trackNs;
const FN: any = (fnOrdersNs as any).default ?? fnOrdersNs;

const listIn = (src: string, after: string, endMark: string): string[] => {
  const a = src.indexOf(after); const b = src.indexOf(endMark, a);
  return [...src.slice(a, b).matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]);
};
const rules = readFileSync('firestore.rules', 'utf8');
const sameSet = (x: string[], y: string[]) => assert.deepEqual([...new Set(x)].sort(), [...new Set(y)].sort());

test('field lists agree between client, rules and server', () => {
  const staffRules = listIn(rules, 'function internalOrderFieldsOnly', ']);').filter((k) => k !== 'updatedAt');
  sameSet(OI.STAFF_INTERNAL_FIELDS, staffRules);
  const createKeys = listIn(rules, 'allow create: if (isAdmin() || isDispatchRole())', "'updatedAt'])").concat(['updatedAt']).filter((k) => k !== 'updatedAt');
  assert.ok(createKeys.length >= OI.STAFF_INTERNAL_FIELDS.length);
  for (const k of OI.STAFF_INTERNAL_FIELDS) assert.ok(createKeys.includes(k), `create rule lacks ${k}`);
  sameSet(OI.SERVER_INTERNAL_FIELDS, FN.SERVER_INTERNAL_FIELDS);
  // none of the private fields may be writable on the customer-readable order
  const orderFields = listIn(rules, 'function adminOrderFieldsOnly', ']);');
  assert.deepEqual(OI.ALL_INTERNAL_FIELDS.filter((k: string) => orderFields.includes(k)), []);
  assert.equal(FN.INTERNAL_ORDER_COLLECTION, 'orderInternal');
  // the admin UI only writes fields the two rule sets accept
  const store = readFileSync('src/utils/orderStore.ts', 'utf8');
  const editable = listIn(store, 'export const ADMIN_EDITABLE_ORDER_FIELDS', '] as const');
  sameSet(editable, [...orderFields.filter((k) => k !== 'updatedAt'), ...OI.STAFF_INTERNAL_FIELDS]);
});

test('splitOrderPatch sends staff-only fields to the internal document and keeps unsafe timeline entries off the customer order', () => {
  const { publicPatch, internalPatch } = OI.splitOrderPatch({
    status: 'shipped', trackingId: 'T1', dispatchNote: 'Shipped with DTDC', internalRemarks: 'customer is rude', assignedStaffName: 'Asha',
    verificationStatus: 'dispatch_ready',
    statusHistory: [
      { status: 'shipped', timestamp: '2026-10-12T09:00:00.000Z', note: 'Shipped with DTDC' },
      { status: 'packing_ready', timestamp: '2026-10-12T08:00:00.000Z', note: 'Verification status updated to packing ready' },
      { nope: true },
    ],
  });
  assert.deepEqual(Object.keys(publicPatch).sort(), ['dispatchNote', 'status', 'statusHistory', 'trackingId']);
  assert.deepEqual(publicPatch.statusHistory.map((h: any) => h.status), ['shipped']);
  assert.equal(internalPatch.internalRemarks, 'customer is rude');
  assert.equal(internalPatch.assignedStaffName, 'Asha');
  assert.equal(internalPatch.verificationStatus, 'dispatch_ready');
  assert.deepEqual(internalPatch.internalLog.map((h: any) => h.status ?? 'junk'), ['packing_ready', 'junk']);
  assert.ok(!JSON.stringify(publicPatch).includes('rude'));
});

test('mergeInternal lays the staff document over the order; legacy private fields on the order still show to staff', () => {
  const order = { id: 'o1', status: 'processing', internalRemarks: 'legacy remark' };
  assert.equal(OI.mergeInternal(order, undefined), order);
  const merged = OI.mergeInternal(order, { internalRemarks: 'new remark', needsRefund: true });
  assert.deepEqual([merged.internalRemarks, merged.needsRefund, merged.status], ['new remark', true, 'processing']);
  assert.equal(OI.mergeInternal({ id: 'o2', status: 'x', internalRemarks: 'legacy' }, {}).internalRemarks, 'legacy');
});

test('the customer tracking timeline never shows internal workflow entries or staff-only text', () => {
  const events = T.buildTrackingEvents({
    createdAt: '2026-10-10T08:00:00.000Z', paymentStatus: 'paid', paidAt: '2026-10-10T08:05:00.000Z', internalRemarks: 'SECRET REMARK', needsRefund: true,
    statusHistory: [
      { status: 'verified', timestamp: '2026-10-10T09:00:00.000Z', note: 'Verification status updated to verified' },
      { status: 'packing_ready', timestamp: '2026-10-10T10:00:00.000Z', note: 'Verification status updated to packing ready' },
      { status: 'shipped', timestamp: '2026-10-11T09:00:00.000Z', note: 'Shipped with DTDC' },
    ],
  });
  const text = JSON.stringify(events);
  assert.deepEqual(events.map((e: any) => e.status), ['Shipped', 'Payment received', 'Order received']);
  assert.ok(!/SECRET|verif|packing/i.test(text));
  assert.ok(text.includes('Shipped with DTDC'));
});

test('server code writes private fields only through the internal document, never onto the order', () => {
  const src = readFileSync('functions/src/orders.ts', 'utf8');
  const code = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).map((l) => l.replace(/\/\/.*$/, ''));
  const fields: string[] = [...FN.SERVER_INTERNAL_FIELDS];
  let hits = 0;
  for (const line of code) {
    if (/SERVER_INTERNAL_FIELDS/.test(line)) continue; // the field-list declaration itself
    if (fields.some((f) => new RegExp(`\\b${f}\\b`).test(line))) { hits++; assert.ok(/internalRef\(/.test(line), `private field written without internalRef: ${line.trim()}`); }
  }
  assert.ok(hits >= 5, 'expected the server transitions to write refund/payment-error fields');
});

test('the dispatch screen no longer publishes verification workflow events to the customer-facing timeline', () => {
  const src = readFileSync('src/pages/dispatch/DispatchDashboardPage.tsx', 'utf8');
  assert.ok(!/newHistory\.push\(\{\s*status:\s*updates\.verificationStatus/.test(src));
  assert.ok(/newLog\.push\(\{\s*status:\s*updates\.verificationStatus/.test(src));
  assert.ok(!/Bulk status update/.test(src));
});
