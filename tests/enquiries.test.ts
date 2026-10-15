import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as docsNs from '../src/utils/enquiryDocs';
import * as modelNs from '../src/utils/contentModel';
import * as fnNs from '../functions/src/enquiries';
import * as resendNs from '../functions/src/resend';

const D: any = (docsNs as any).default ?? docsNs;
const M: any = (modelNs as any).default ?? modelNs;
const F: any = (fnNs as any).default ?? fnNs;
const R: any = (resendNs as any).default ?? resendNs;
const NOW = new Date('2026-10-15T10:00:00Z');

test('contact doc: cleaned, lower-cased email, capped, status pending; invalid email/empty message refused', () => {
  const ok = D.buildContactDoc({ firstName: '  Asha ', lastName: 'K', email: ' ASHA@Example.COM ', phone: '98765\n43210', subject: 'Order', message: 'Hello\nthere' }, NOW);
  assert.equal(ok.ok, true);
  assert.deepEqual(Object.keys(ok.data).sort(), ['createdAt', 'email', 'firstName', 'lastName', 'message', 'phone', 'source', 'status', 'subject']);
  assert.equal(ok.data.email, 'asha@example.com');
  assert.equal(ok.data.firstName, 'Asha');
  assert.equal(ok.data.phone, '98765 43210');
  assert.equal(ok.data.message, 'Hello\nthere'); // newlines kept in the message
  assert.equal(ok.data.status, 'pending');
  assert.equal(D.buildContactDoc({ email: 'nope', message: 'x' }, NOW).ok, false);
  assert.equal(D.buildContactDoc({ email: 'a@b.co', message: '   ' }, NOW).ok, false);
  const long = D.buildContactDoc({ email: 'a@b.co', message: 'x'.repeat(5000), firstName: 'n'.repeat(500) }, NOW);
  assert.equal(long.data.message.length, 3000);
  assert.equal(long.data.firstName.length, 100);
});

test('wholesale doc: required name+email, small image kept, big/odd image dropped and flagged', () => {
  const base = { full_name: 'Raj', email: 'raj@x.co', company_name: 'RT' };
  assert.equal(D.buildWholesaleDoc({ email: 'raj@x.co' }, NOW).ok, false);
  assert.equal(D.buildWholesaleDoc({ full_name: 'Raj', email: 'bad' }, NOW).ok, false);
  const small = D.buildWholesaleDoc({ ...base, image: 'data:image/png;base64,AAAA' }, NOW);
  assert.equal(small.data.image, 'data:image/png;base64,AAAA');
  const big = D.buildWholesaleDoc({ ...base, image: 'data:image/png;base64,' + 'A'.repeat(300000) }, NOW);
  assert.equal(big.data.image, undefined); assert.equal(big.data.imageOmitted, true);
  const odd = D.buildWholesaleDoc({ ...base, image: 'data:text/html;base64,AAAA' }, NOW);
  assert.equal(odd.data.imageOmitted, true);
  assert.equal(small.data.created_at, small.data.createdAt);
});

test('newsletter doc: id is the lower-case email; slashes/invalid refused', () => {
  const ok = D.buildNewsletterDoc('  Me@Shop.IN ', NOW);
  assert.equal(ok.data.id, 'me@shop.in'); assert.equal(ok.data.data.email, 'me@shop.in'); assert.equal(ok.data.data.status, 'subscribed');
  assert.equal(D.buildNewsletterDoc('a/b@c.co', NOW).ok, false);
  assert.equal(D.buildNewsletterDoc('x', NOW).ok, false);
});

test('client cooldown', () => {
  const store = { getItem: () => String(1_000_000) };
  assert.equal(D.cooldownRemaining(store, 'k', 1_005_000, 15_000), 10_000);
  assert.equal(D.cooldownRemaining(store, 'k', 1_100_000, 15_000), 0);
  assert.equal(D.cooldownRemaining({ getItem: () => null }, 'k', 1_700_000_000_000, 15_000), 0);
});

test('collections: only visible ones, ordered, mapped to the storefront shape; firestore clean-up drops junk', () => {
  const list = [
    { id: 'b', name: 'B', slug: 'b', shortDescription: 's', longDescription: 'l', bannerImageUrl: '/b.png', heroImageUrl: '', isVisible: true, sortOrder: 2 },
    { id: 'a', name: 'A', slug: 'a-slug', shortDescription: '', longDescription: '', bannerImageUrl: '', heroImageUrl: '/h.png', isVisible: true, sortOrder: 1 },
    { id: 'c', name: 'C', slug: 'c', shortDescription: '', longDescription: '', bannerImageUrl: '', heroImageUrl: '', isVisible: false, sortOrder: 0 },
  ];
  const out = M.toStorefrontCollections(list);
  assert.deepEqual(out.map((c: any) => c.id), ['a-slug', 'b']);
  assert.equal(out[0].image, '/h.png'); assert.equal(out[0].fullName, 'A');
  assert.deepEqual(M.toStorefrontCollections(null as any), []);
  const clean = M.cleanCollectionForFirestore({ ...list[0], extra: 'x', sortOrder: NaN, name: 'n'.repeat(400) } as any);
  assert.equal(clean.sortOrder, 0); assert.equal(clean.name.length, 200); assert.equal((clean as any).extra, undefined);
});

test('publish helpers: size limit, malformed json, policy overrides only for the current version', () => {
  assert.equal(M.serialiseForPublish({ a: 1 }).ok, true);
  assert.equal(M.serialiseForPublish({ big: 'x'.repeat(1_000_000) }).ok, false);
  assert.equal(M.serialiseForPublish(undefined).ok, false);
  assert.equal(M.parsePublished('{"a":1}').a, 1);
  assert.equal(M.parsePublished('{bad'), null); assert.equal(M.parsePublished(5), null);
  assert.equal(M.usablePolicyOverrides({ version: 'v2', overrides: { returns: { title: 'x' } } }, 'v1'), null);
  assert.ok(M.usablePolicyOverrides({ version: 'v1', overrides: {} }, 'v1'));
  assert.equal(M.usablePolicyOverrides(null, 'v1'), null);
});

test('owner enquiry mail: escapes everything, one deterministic doc, reply-to only for a valid email, no mail without owner address', () => {
  const d = { firstName: '<b>Eve</b>', lastName: 'X', email: 'eve@x.co', phone: '9', subject: 'Hi\nBcc: evil@x.co', message: '<script>alert(1)</script>\nline2' };
  const m = F.buildEnquiryMailDoc('contact', 'abc', d, 'owner@shop.in');
  assert.equal(m.id, 'enquiry-contact-abc'); assert.equal(m.data.to, 'owner@shop.in'); assert.equal(m.data.replyTo, 'eve@x.co');
  assert.ok(!m.data.message.html.includes('<script>')); assert.ok(m.data.message.html.includes('&lt;script&gt;'));
  assert.ok(!m.data.message.subject.includes('\n'));
  assert.equal(F.buildEnquiryMailDoc('contact', 'abc', { ...d, email: 'not-valid' }, 'owner@shop.in').data.replyTo, undefined);
  assert.equal(F.buildEnquiryMailDoc('contact', 'abc', d, ''), null);
  assert.equal(F.buildEnquiryMailDoc('contact', 'abc', d, 'bad'), null);
  const w = F.buildEnquiryMailDoc('wholesale', 'w1', { full_name: 'Raj', company_name: 'RT', email: 'raj@x.co', message: 'm' }, 'owner@shop.in');
  assert.equal(w.id, 'enquiry-wholesale-w1'); assert.match(w.data.message.subject, /Wholesale enquiry: Raj \(RT\)/);
});

test('owner mail throttle: 20 per hour, then silent until the window passes; clock going backwards resets', () => {
  let st: any = undefined; let allowed = 0; const t0 = 1_000_000;
  for (let i = 0; i < 30; i++) { const r = F.nextThrottle(st, t0 + i, 20, 3_600_000); st = r.state; if (r.allowed) allowed++; }
  assert.equal(allowed, 20);
  const later = F.nextThrottle(st, t0 + 3_600_001, 20, 3_600_000);
  assert.equal(later.allowed, true); assert.equal(later.state.count, 1);
  assert.equal(F.nextThrottle({ windowStart: t0 + 99, count: 99 }, t0, 20, 3_600_000).allowed, true);
});

test('Resend passes reply_to only for a valid address', async () => {
  let body: any;
  const ok = async (_u: string, init: any) => { body = JSON.parse(init.body); return { ok: true, status: 200, json: async () => ({ id: 'r1' }) }; };
  await R.sendViaResend(ok, 'K', 'Shop <a@b.co>', 'm1', { to: 'o@x.co', replyTo: 'eve@x.co', message: { subject: 's', text: 't' } });
  assert.equal(body.reply_to, 'eve@x.co');
  await R.sendViaResend(ok, 'K', 'Shop <a@b.co>', 'm2', { to: 'o@x.co', replyTo: 'bad', message: { subject: 's', text: 't' } });
  assert.equal(body.reply_to, undefined);
});
