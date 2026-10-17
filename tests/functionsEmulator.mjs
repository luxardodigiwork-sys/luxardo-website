// Real Functions + Firestore emulator run: writes enquiries as an anonymous client would and waits for the triggers.
// Covers trigger wiring, throttle behaviour and the failure path (RESEND_API_KEY empty => no network call, delivery ERROR).
// Does NOT prove production region compatibility or real Resend delivery.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const req = createRequire(new URL('../functions/package.json', import.meta.url));
const admin = req('firebase-admin');
admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-notify' });
const db = admin.firestore();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, what, ms = 40000) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(`timeout waiting for ${what}`);
    await sleep(500);
  }
}
const contact = (n, email) => ({ firstName: 'T', lastName: String(n), email, message: `hello ${n}`, status: 'pending', createdAt: new Date().toISOString(), source: 'contact' });

// 1. contact trigger -> mail doc (deterministic id) -> sendQueuedMailFn records ERROR (no key) -> enquiry marked queued
await db.collection('contactMessages').doc('e1').set(contact(1, 'a@example.com'));
const mail = await waitFor(async () => { const s = await db.collection('mail').doc('enquiry-contact-e1').get(); return s.exists && s.data().delivery ? s.data() : null; }, 'mail e1 delivery');
assert.equal(mail.to, 'owner@example.com');
assert.equal(mail.replyTo, 'a@example.com');
assert.equal(mail.delivery.state, 'ERROR');
assert.match(mail.delivery.error, /RESEND_API_KEY is not set/);
assert.equal((await db.collection('contactMessages').doc('e1').get()).data().notifyState, 'queued');
console.log('ok contact trigger -> mail -> delivery ERROR recorded');

// 2. wholesale trigger
await db.collection('wholesaleInquiries').doc('w1').set({ full_name: 'W', email: 'w@example.com', message: 'm', status: 'pending', createdAt: new Date().toISOString() });
await waitFor(async () => (await db.collection('mail').doc('enquiry-wholesale-w1').get()).exists, 'wholesale mail');
console.log('ok wholesale trigger -> mail');

// 3. sender limit through the real triggers
for (let i = 2; i <= 6; i++) await db.collection('contactMessages').doc(`e${i}`).set(contact(i, 'spam@example.com'));
await waitFor(async () => (await db.collection('contactMessages').where('notifyState', '==', 'sender-limited').get()).size === 2, 'two sender-limited enquiries');
assert.equal((await db.collection('contactMessages').get()).size, 6); // none lost
console.log('ok per-sender limit: 3 queued, 2 held back, nothing lost');

// 4. firestore rules: client SDK path is covered in tests/rules.test.mjs
console.log('FUNCTIONS EMULATOR OK');
process.exit(0);
