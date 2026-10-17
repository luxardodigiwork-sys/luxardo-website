// Owner-notification logic against the Firestore emulator: transactional limits, retries, digest, failures.
// Run via `npm run test:notify` (starts the emulator). Real Resend delivery and trigger region are NOT covered here.
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as notifyNs from '../functions/src/enquiryNotify';
import * as queueNs from '../functions/src/mailQueue';
import * as resendNs from '../functions/src/resend';
const unwrap = <T,>(m: T): T => (m as any).default ?? m;
const { queueEnquiryMail, sendEnquiryDigest, GLOBAL_MAX_PER_HOUR, SENDER_MAX_PER_HOUR } = unwrap(notifyNs);
const { processQueuedMail, MAX_MAIL_ATTEMPTS, RetryMailError } = unwrap(queueNs);
const { sendViaResend } = unwrap(resendNs);

const requireFromFunctions = createRequire(new URL('../functions/package.json', import.meta.url));
const admin = requireFromFunctions('firebase-admin');
let db: FirebaseFirestore.Firestore;
const OWNER = 'owner@example.com';
const T0 = Date.UTC(2026, 0, 1, 10, 0, 0);

before(() => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'Run via `npm run test:notify` so the Firestore emulator is used.');
  admin.initializeApp({ projectId: 'notify-test' });
  db = admin.firestore();
});
beforeEach(async () => {
  for (const c of ['contactMessages', 'wholesaleInquiries', 'mail', 'meta', 'enquiryLimits']) {
    for (const d of (await db.collection(c).get()).docs) await d.ref.delete();
  }
});

const enquiry = async (id: string, email = `${id}@example.com`, extra: Record<string, unknown> = {}) => {
  const data = { firstName: 'A', lastName: 'B', email, message: 'hello <b>x</b>', status: 'pending', ...extra };
  await db.collection('contactMessages').doc(id).set(data);
  return data;
};
const stateOf = async (id: string) => (await db.collection('contactMessages').doc(id).get()).data()!.notifyState;

test('queues exactly one owner mail with a deterministic id and escaped HTML', async () => {
  const d = await enquiry('c1');
  assert.equal(await queueEnquiryMail(db, 'contact', 'c1', d, OWNER, T0), 'queued');
  const m = await db.collection('mail').doc('enquiry-contact-c1').get();
  assert.ok(m.exists);
  assert.equal(m.data()!.to, OWNER);
  assert.equal(m.data()!.replyTo, 'c1@example.com');
  assert.ok(!m.data()!.message.html.includes('<b>x</b>'));
  assert.ok(m.data()!.message.html.includes('&lt;b&gt;x&lt;/b&gt;'));
  assert.equal(await stateOf('c1'), 'queued');
});

test('a retried trigger is a duplicate and does not consume the limits twice', async () => {
  const d = await enquiry('c1');
  await queueEnquiryMail(db, 'contact', 'c1', d, OWNER, T0);
  assert.equal(await queueEnquiryMail(db, 'contact', 'c1', d, OWNER, T0 + 1000), 'duplicate');
  assert.equal((await db.collection('meta').doc('enquiryEmailThrottle').get()).data()!.count, 1);
  assert.equal((await db.collection('mail').get()).size, 1);
});

// A 26-way burst on one throttle document can exhaust the emulator's own transaction retries ("10 ABORTED: Transaction lock timeout").
// In production the trigger runs with retry:true, which re-delivers the event; this helper plays that role for the test.
// Only ABORTED is retried (bounded, short backoff); every other error and every assertion still fails the test.
// Retrying is safe: an aborted transaction committed nothing, and a committed one would report 'duplicate'.
const retryOnAbort = async <T,>(fn: () => Promise<T>, attempts = 8): Promise<T> => {
  for (let i = 1; ; i++) {
    try { return await fn(); } catch (e) {
      if ((e as { code?: number }).code !== 10 || i >= attempts) throw e;
      await new Promise((r) => setTimeout(r, 25 * i + Math.floor(Math.random() * 25)));
    }
  }
};

test('concurrent triggers for different enquiries never exceed the global limit and never lose an enquiry', async () => {
  const n = GLOBAL_MAX_PER_HOUR + 6;
  const ids = Array.from({ length: n }, (_, i) => `g${i}`);
  const datas = await Promise.all(ids.map((id) => enquiry(id)));
  const out = await Promise.all(ids.map((id, i) => retryOnAbort(() => queueEnquiryMail(db, 'contact', id, datas[i], OWNER, T0))));
  assert.equal(out.filter((o: string) => o === 'queued').length, GLOBAL_MAX_PER_HOUR);
  assert.equal(out.filter((o: string) => o === 'throttled').length, 6);
  assert.equal((await db.collection('mail').get()).size, GLOBAL_MAX_PER_HOUR);
  assert.equal((await db.collection('contactMessages').get()).size, n); // every enquiry still stored
});

test('per-sender limit holds back a spammer without consuming the global budget', async () => {
  const out: string[] = [];
  for (let i = 0; i < SENDER_MAX_PER_HOUR + 2; i++) {
    const d = await enquiry(`s${i}`, 'Spammer@Example.com');
    out.push(await queueEnquiryMail(db, 'contact', `s${i}`, d, OWNER, T0 + i));
  }
  assert.deepEqual(out, ['queued', 'queued', 'queued', 'sender-limited', 'sender-limited']);
  assert.equal((await db.collection('meta').doc('enquiryEmailThrottle').get()).data()!.count, SENDER_MAX_PER_HOUR);
  const other = await enquiry('real', 'real@example.com');
  assert.equal(await queueEnquiryMail(db, 'contact', 'real', other, OWNER, T0 + 50), 'queued'); // a genuine visitor is unaffected
  assert.equal(await stateOf('s4'), 'sender-limited');
});

test('limits reset after the hour', async () => {
  for (let i = 0; i < SENDER_MAX_PER_HOUR; i++) {
    const d = await enquiry(`a${i}`, 'x@example.com');
    assert.equal(await queueEnquiryMail(db, 'contact', `a${i}`, d, OWNER, T0), 'queued');
  }
  const blocked = await enquiry('b', 'x@example.com');
  assert.equal(await queueEnquiryMail(db, 'contact', 'b', blocked, OWNER, T0 + 1000), 'sender-limited');
  const late = await enquiry('late', 'x@example.com');
  assert.equal(await queueEnquiryMail(db, 'contact', 'late', late, OWNER, T0 + 3_700_000), 'queued');
});

test('no or invalid owner address: nothing queued, enquiry untouched', async () => {
  const d = await enquiry('c1');
  assert.equal(await queueEnquiryMail(db, 'contact', 'c1', d, '', T0), 'no-owner');
  assert.equal(await queueEnquiryMail(db, 'contact', 'c1', d, 'not-an-email', T0), 'no-owner');
  assert.equal((await db.collection('mail').get()).size, 0);
});

test('digest reports held-back enquiries once per hour, marks them digested and survives a re-run', async () => {
  for (let i = 0; i < SENDER_MAX_PER_HOUR + 1; i++) {
    const d = await enquiry(`s${i}`, 'spam@example.com', { firstName: '<script>' });
    await queueEnquiryMail(db, 'contact', `s${i}`, d, OWNER, T0 + i);
  }
  assert.deepEqual(await sendEnquiryDigest(db, OWNER, T0 + 1000), { sent: true, held: 1, failed: 0 });
  const digest = await db.collection('mail').doc(`enquiry-digest-${Math.floor((T0 + 1000) / 3_600_000)}`).get();
  assert.ok(digest.exists);
  assert.ok(!digest.data()!.message.html.includes('<script>'));
  assert.equal(await stateOf(`s${SENDER_MAX_PER_HOUR}`), 'digested');
  assert.deepEqual(await sendEnquiryDigest(db, OWNER, T0 + 2000), { sent: false, held: 0, failed: 0 });
});

test('digest is skipped when the same-hour digest exists but enquiries stay held for the next hour', async () => {
  await db.collection('mail').doc(`enquiry-digest-${Math.floor(T0 / 3_600_000)}`).set({ to: OWNER });
  await db.collection('contactMessages').doc('h').set({ email: 'h@example.com', notifyState: 'throttled' });
  assert.deepEqual(await sendEnquiryDigest(db, OWNER, T0), { sent: false, held: 1, failed: 0 });
  assert.equal(await stateOf('h'), 'throttled');
  assert.equal((await sendEnquiryDigest(db, OWNER, T0 + 3_600_000)).sent, true);
});

test('digest includes failed enquiry mails exactly once', async () => {
  await db.collection('mail').doc('enquiry-contact-z').set({ kind: 'enquiry', delivery: { state: 'ERROR', error: 'resend 403: domain not verified' } });
  assert.deepEqual(await sendEnquiryDigest(db, OWNER, T0), { sent: true, held: 0, failed: 1 });
  assert.deepEqual(await sendEnquiryDigest(db, OWNER, T0 + 3_600_000), { sent: false, held: 0, failed: 0 });
});

// ── mail delivery state machine ──
const queued = async (id: string) => { await db.collection('mail').doc(id).set({ to: OWNER, kind: 'enquiry', message: { subject: 's', text: 't' } }); return db.collection('mail').doc(id); };
const deliveryOf = async (id: string) => (await db.collection('mail').doc(id).get()).data()!.delivery;

test('delivery: success is recorded and a repeat event does not send again', async () => {
  const ref = await queued('m1');
  let calls = 0;
  const send = async () => { calls++; return { ok: true as const, id: 're_1' }; };
  assert.equal(await processQueuedMail(ref, send), 'sent');
  assert.equal(await processQueuedMail(ref, send), 'skipped');
  assert.equal(calls, 1);
  assert.equal((await deliveryOf('m1')).state, 'SUCCESS');
});

test('delivery: permanent error is recorded as ERROR without retry', async () => {
  const ref = await queued('m2');
  assert.equal(await processQueuedMail(ref, async () => ({ ok: false as const, error: 'resend 403: bad', retryable: false })), 'failed');
  const d = await deliveryOf('m2');
  assert.equal(d.state, 'ERROR');
  assert.equal(d.attempts, 1);
});

test('delivery: transient errors retry (throw) up to the limit, then settle as ERROR; a later success wins', async () => {
  const ref = await queued('m3');
  const flaky = async () => ({ ok: false as const, error: 'network: down', retryable: true });
  for (let i = 1; i < MAX_MAIL_ATTEMPTS; i++) {
    await assert.rejects(() => processQueuedMail(ref, flaky), RetryMailError);
    assert.deepEqual([(await deliveryOf('m3')).state, (await deliveryOf('m3')).attempts], ['RETRY', i]);
  }
  assert.equal(await processQueuedMail(ref, flaky), 'failed');
  assert.equal((await deliveryOf('m3')).state, 'ERROR');

  const ref2 = await queued('m4');
  await assert.rejects(() => processQueuedMail(ref2, flaky), RetryMailError);
  assert.equal(await processQueuedMail(ref2, async () => ({ ok: true as const, id: 're_2' })), 'sent');
  assert.deepEqual([(await deliveryOf('m4')).state, (await deliveryOf('m4')).attempts], ['SUCCESS', 2]);
});

test('delivery: extension-handled or deleted mail is skipped; Resend failure classes map to retryable', async () => {
  await db.collection('mail').doc('m5').set({ to: OWNER, delivery: { state: 'SUCCESS' } });
  assert.equal(await processQueuedMail(db.collection('mail').doc('m5'), async () => { throw new Error('must not send'); }), 'skipped');
  assert.equal(await processQueuedMail(db.collection('mail').doc('missing'), async () => { throw new Error('must not send'); }), 'skipped');
  const doc = { to: OWNER, message: { subject: 's', text: 't' } };
  const res = (status: number) => async () => ({ ok: false, status, json: async () => ({ message: 'x' }) });
  assert.equal((await sendViaResend(res(429) as any, 'K', 'f', 'i', doc) as any).retryable, true);
  assert.equal((await sendViaResend(res(503) as any, 'K', 'f', 'i', doc) as any).retryable, true);
  assert.equal((await sendViaResend(res(403) as any, 'K', 'f', 'i', doc) as any).retryable, false);
  assert.equal((await sendViaResend((async () => { throw new Error('boom'); }) as any, 'K', 'f', 'i', doc) as any).retryable, true);
});
