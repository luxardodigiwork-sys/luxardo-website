// Guards against the legacy (pre-rewrite) payment functions coming back. Static checks on functions/src only:
// they do NOT prove anything about what is deployed in production (the legacy functions may still be live there).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import * as coreNs from '../functions/src/core';
const core: any = (coreNs as any).default ?? coreNs;

const SRC = 'functions/src';
const files = readdirSync(SRC).filter((f) => f.endsWith('.ts'));
const read = (f: string) => readFileSync(`${SRC}/${f}`, 'utf8');

/** The intended Cloud Function exports of functions/src/index.ts (checked against the real file; REGION is a plain constant). */
const APPROVED_EXPORTS = [
  'cancelOrderFn', 'createCheckoutOrderFn', 'enquiryDigestFn', 'onContactMessageFn', 'onWholesaleInquiryFn', 'razorpayWebhook',
  'releaseExpiredOrdersFn', 'requestCancellationFn', 'requestReturnFn', 'sendQueuedMailFn', 'setStaffRoleFn', 'verifyPaymentFn',
];
const PLAIN_CONSTANT_EXPORTS = ['REGION'];
/** Names of functions that exist (or existed) in production but must never be exported from this source again. */
const LEGACY_NAMES = ['createRazorpayOrder', 'verifyRazorpayPayment', 'onOrderPaid', 'onProductUpdated', 'abandonedCartReminder', 'sendBroadcastNotification', 'nextId'];

export function exportedNames(src: string): string[] {
  return [...src.matchAll(/^export\s+(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z0-9_$]+)/gm)].map((m) => m[1]);
}

/** Patterns that made the legacy webhook forgeable: env-var secrets, empty-string fallbacks, v1 functions API. */
export function findPaymentSecretProblems(src: string): string[] {
  const problems: string[] = [];
  if (/process\.env/.test(src)) problems.push('reads process.env');
  if (/from\s+["']firebase-functions(\/v1)?["']/.test(src)) problems.push('imports the v1 firebase-functions API');
  if (/functions\.https\./.test(src)) problems.push('uses functions.https (v1)');
  if (/(SECRET|KEY)[A-Za-z_]*\s*[:=][^;\n]*(\|\||\?\?)\s*["'`]\s*["'`]/i.test(src)) problems.push('falls back to an empty string for a secret/key');
  return problems;
}

test('index.ts exports exactly the approved Cloud Functions (no legacy payment functions)', () => {
  const index = read('index.ts');
  const names = exportedNames(index);
  const functionsOnly = names.filter((n) => !PLAIN_CONSTANT_EXPORTS.includes(n)).sort();
  assert.deepEqual(functionsOnly, [...APPROVED_EXPORTS].sort());
  assert.ok(PLAIN_CONSTANT_EXPORTS.every((n) => names.includes(n)));
  assert.ok(!/^export\s*(\*|\{)/m.test(index), 'index.ts must not re-export other modules (they would become deployed functions)');
});

test('no source file exports or mentions a legacy payment function name', () => {
  for (const f of files) {
    const src = read(f);
    for (const n of LEGACY_NAMES) assert.ok(!new RegExp(`\\b${n}\\b`).test(src), `${f} mentions legacy function ${n}`);
    assert.ok(exportedNames(src).every((n) => !LEGACY_NAMES.includes(n)), `${f} exports a legacy name`);
  }
});

test('no source file uses env-var secrets, empty-string secret fallbacks or the v1 functions API', () => {
  for (const f of files) assert.deepEqual(findPaymentSecretProblems(read(f)), [], f);
});

test('Razorpay secrets come only from Firebase secret parameters and are bound to the functions that need them', () => {
  const index = read('index.ts');
  assert.match(index, /RAZORPAY_KEY_SECRET\s*=\s*defineSecret\(\s*["']RAZORPAY_KEY_SECRET["']\s*\)/);
  assert.match(index, /RAZORPAY_WEBHOOK_SECRET\s*=\s*defineSecret\(\s*["']RAZORPAY_WEBHOOK_SECRET["']\s*\)/);
  const webhook = index.slice(index.indexOf('export const razorpayWebhook'), index.indexOf('export const requestCancellationFn'));
  assert.match(webhook, /secrets:\s*\[[^\]]*RAZORPAY_WEBHOOK_SECRET[^\]]*\]/);
  assert.match(webhook, /secret:\s*RAZORPAY_WEBHOOK_SECRET\.value\(\)/);
});

test('the scanner itself detects the legacy code shape (so a regression would be caught)', () => {
  const legacy = [
    'import * as functions from "firebase-functions";',
    'const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "";',
    'export const verifyRazorpayPayment = functions.https.onRequest(async () => {});',
  ].join('\n');
  const problems = findPaymentSecretProblems(legacy);
  assert.ok(problems.includes('reads process.env'));
  assert.ok(problems.includes('imports the v1 firebase-functions API'));
  assert.ok(problems.includes('uses functions.https (v1)'));
  assert.ok(problems.includes('falls back to an empty string for a secret/key'));
  assert.deepEqual(exportedNames(legacy), ['verifyRazorpayPayment']);
  assert.ok(exportedNames(legacy).some((n) => LEGACY_NAMES.includes(n)));
});

test('an empty webhook/payment secret never validates a signature made with the empty key', () => {
  const body = Buffer.from('{"event":"payment.captured"}');
  const forged = createHmac('sha256', '').update(body).digest('hex');
  assert.equal(core.verifyWebhookSignature(body, forged, ''), false);
  assert.equal(core.verifyWebhookSignature(body, forged, 'real-secret'), false);
  const payForged = createHmac('sha256', '').update('order_1|pay_1').digest('hex');
  assert.equal(core.verifyPaymentSignature('order_1', 'pay_1', payForged, ''), false);
});
