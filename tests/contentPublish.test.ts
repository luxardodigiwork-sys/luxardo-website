// Admin publish integrity (version checks, sync gate, collection deletion safety) against the Firestore emulator
// with the REAL firestore.rules. Run via `npm run test:publish`. Browser/UI behaviour is not covered here.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, getDocs, collection } from 'firebase/firestore';
import * as pubNs from '../src/utils/contentPublish';
import * as modelNs from '../src/utils/contentModel';
import * as constNs from '../src/constants';
const unwrap = <T,>(m: T): T => (m as any).default ?? m;
const { newRemoteState, publishJsonDoc, publishCollectionList, revOf, describePublishError } = unwrap(pubNs);
const { adminCollectionsFromStorefront, toStorefrontCollections } = unwrap(modelNs);
const { COLLECTIONS } = unwrap(constNs);

const OWNER_UID = '0Frc6Dy2MqN0zc0UFkmqvpELFnr1';
let env: any;
before(async () => { env = await initializeTestEnvironment({ projectId: 'publish-test', firestore: { rules: readFileSync('firestore.rules', 'utf8') } }); });
after(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const adminFs = () => env.authenticatedContext(OWNER_UID, { firebase: { sign_in_provider: 'phone' } }).firestore();
const ready = (over: Record<string, unknown> = {}) => ({ ...newRemoteState(), ready: true, ...over });
const col = (id: string, over: Record<string, unknown> = {}) => ({ id, name: `Name ${id}`, slug: id, shortDescription: '', longDescription: '', bannerImageUrl: '', heroImageUrl: '', isVisible: true, sortOrder: 1, ...over });
const seedRemote = (path: string, data: any) => env.withSecurityRulesDisabled((c: any) => setDoc(doc(c.firestore(), path), data));
const viaAdmin = async <T,>(fn: (fs: any) => Promise<T>): Promise<T> => { let out: T; await env.withSecurityRulesDisabled(async (c: any) => { out = await fn(c.firestore()); }); return out!; };
const remoteDoc = (path: string) => viaAdmin(async (fs) => (await getDoc(doc(fs, path))).data());
const remoteIds = () => viaAdmin(async (fs) => (await getDocs(collection(fs, 'collections'))).docs.map((d: any) => d.id).sort());
const rejectsWith = async (p: Promise<unknown>, code: string) => {
  await assert.rejects(p, (e: any) => { assert.equal(e.name, 'PublishError'); assert.equal(e.code, code); assert.ok(describePublishError(e)); return true; });
};

test('saving is refused until the initial sync succeeded, and nothing is written', async () => {
  const state = newRemoteState(); // ready=false
  await rejectsWith(publishJsonDoc(adminFs(), state, 'site', ['siteContent', 'main'], '{"a":1}', {}), 'sync-not-ready');
  await rejectsWith(publishCollectionList(adminFs(), state, [col('a')], {}), 'sync-not-ready');
  assert.equal(await remoteDoc('siteContent/main'), undefined);
  assert.deepEqual(await remoteIds(), []);
});

test('first publish when the remote document is missing works and starts the revision at 1; later saves chain', async () => {
  const state = ready();
  await publishJsonDoc(adminFs(), state, 'site', ['siteContent', 'main'], '{"v":1}', { updatedBy: 'x' });
  assert.equal(state.site, 1);
  assert.deepEqual([(await remoteDoc('siteContent/main')).json, (await remoteDoc('siteContent/main')).rev], ['{"v":1}', 1]);
  await publishJsonDoc(adminFs(), state, 'site', ['siteContent', 'main'], '{"v":2}', {});
  assert.equal((await remoteDoc('siteContent/main')).rev, 2);
});

test('stale admin cannot overwrite newer site content or policies', async () => {
  await seedRemote('siteContent/main', { json: '{"by":"other"}', rev: 3 });
  await seedRemote('policies/main', { json: '{"by":"other"}', rev: 2 });
  const stale = ready({ site: 2, policies: 1 });
  await rejectsWith(publishJsonDoc(adminFs(), stale, 'site', ['siteContent', 'main'], '{"by":"stale"}', {}), 'conflict');
  await rejectsWith(publishJsonDoc(adminFs(), stale, 'policies', ['policies', 'main'], '{"by":"stale"}', {}), 'conflict');
  assert.equal((await remoteDoc('siteContent/main')).json, '{"by":"other"}');
  assert.equal((await remoteDoc('policies/main')).json, '{"by":"other"}');
  // an admin who has the latest revision can save
  await publishJsonDoc(adminFs(), ready({ site: 3 }), 'site', ['siteContent', 'main'], '{"by":"fresh"}', {});
  assert.equal((await remoteDoc('siteContent/main')).rev, 4);
});

test('two admins saving at the same revision: exactly one wins, the other gets a conflict', async () => {
  await seedRemote('policies/main', { json: '{}', rev: 5 });
  const results = await Promise.allSettled(['A', 'B'].map((who) =>
    publishJsonDoc(adminFs(), ready({ policies: 5 }), 'policies', ['policies', 'main'], JSON.stringify({ who }), {})));
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  const lost = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
  assert.equal(lost.reason.code, 'conflict');
  assert.equal((await remoteDoc('policies/main')).rev, 6);
});

test('legacy or malformed remote documents (no rev) are revision 0 and can be repaired explicitly', async () => {
  await seedRemote('siteContent/main', { json: 'not json {{' });
  assert.equal(revOf(await remoteDoc('siteContent/main')), 0);
  const state = ready();
  await publishJsonDoc(adminFs(), state, 'site', ['siteContent', 'main'], '{"ok":true}', {});
  assert.equal((await remoteDoc('siteContent/main')).rev, 1);
  assert.equal(revOf({ rev: 'x' }), 0);
  assert.equal(revOf({ rev: -4 }), 0);
  assert.equal(revOf(undefined), 0);
});

test('a non-admin cannot publish (real rules), even with a matching revision', async () => {
  const customer = env.authenticatedContext('cust1', { firebase: { sign_in_provider: 'phone' } }).firestore();
  await assert.rejects(publishJsonDoc(customer, ready(), 'site', ['siteContent', 'main'], '{}', {}), (e: any) => e.code === 'permission-denied');
});

test('collections: first publish of an uninitialised site deletes nothing and sets the lock revision', async () => {
  const state = ready();
  await publishCollectionList(adminFs(), state, [col('a'), col('b', { sortOrder: 2 })], {});
  assert.deepEqual(await remoteIds(), ['a', 'b']);
  assert.equal((await remoteDoc('siteContent/collectionsMeta')).rev, 1);
  assert.deepEqual(state.collectionIds, ['a', 'b']);
});

test('collections: a stale admin cannot delete or overwrite what another admin added', async () => {
  await seedRemote('collections/a', col('a'));
  await seedRemote('siteContent/collectionsMeta', { initialized: true, rev: 1 });
  const staleState = ready({ collections: 1, collectionIds: ['a'] });
  // another admin adds "b" and bumps the lock
  const other = ready({ collections: 1, collectionIds: ['a'] });
  await publishCollectionList(adminFs(), other, [col('a'), col('b')], {});
  // stale admin (saw only "a") tries to publish a list without "b"
  await rejectsWith(publishCollectionList(adminFs(), staleState, [col('a', { name: 'Edited' })], {}), 'conflict');
  assert.deepEqual(await remoteIds(), ['a', 'b']);
  assert.equal((await remoteDoc('collections/a')).name, 'Name a');
});

test('collections: only ids the admin saw are deleted; a document outside that set survives', async () => {
  await seedRemote('collections/a', col('a')); await seedRemote('collections/b', col('b')); await seedRemote('collections/c', col('c'));
  await seedRemote('collections/legacy', col('legacy')); // created without a lock bump, never seen by this admin
  await seedRemote('siteContent/collectionsMeta', { initialized: true, rev: 4 });
  const state = ready({ collections: 4, collectionIds: ['a', 'b', 'c'] });
  await publishCollectionList(adminFs(), state, [col('a'), col('b')], {});
  assert.deepEqual(await remoteIds(), ['a', 'b', 'legacy']);
});

test('collections: an empty list over existing collections needs an explicit allowEmpty', async () => {
  const state = ready();
  await publishCollectionList(adminFs(), state, [col('a')], {});
  await rejectsWith(publishCollectionList(adminFs(), state, [], {}), 'empty-list');
  assert.deepEqual(await remoteIds(), ['a']);
  await publishCollectionList(adminFs(), state, [], {}, { allowEmpty: true });
  assert.deepEqual(await remoteIds(), []);
});

test('collections: duplicate id / duplicate URL / missing name are rejected before any write', async () => {
  const state = ready();
  await rejectsWith(publishCollectionList(adminFs(), state, [col('a'), col('a')], {}), 'invalid');
  await rejectsWith(publishCollectionList(adminFs(), state, [col('a'), col('b', { slug: 'a' })], {}), 'invalid');
  await rejectsWith(publishCollectionList(adminFs(), state, [col('a', { name: '  ' })], {}), 'invalid');
  assert.deepEqual(await remoteIds(), []);
  assert.equal(await remoteDoc('siteContent/collectionsMeta'), undefined);
});

// ── default collections: no garment seed, existing ids/URLs preserved ──
test('the admin starting list is the storefront list with identical ids, slugs and names (no URL or category change)', () => {
  const admin = adminCollectionsFromStorefront(COLLECTIONS);
  assert.deepEqual(admin.map((c: any) => c.id), COLLECTIONS.map((c: any) => c.id));
  assert.deepEqual(admin.map((c: any) => c.slug), COLLECTIONS.map((c: any) => c.id));
  assert.deepEqual(admin.map((c: any) => c.name), COLLECTIONS.map((c: any) => c.fullName));
  const roundTrip = toStorefrontCollections(admin);
  assert.deepEqual(roundTrip.map((c: any) => c.id), COLLECTIONS.map((c: any) => c.id));
  assert.deepEqual(roundTrip.map((c: any) => c.fullName), COLLECTIONS.map((c: any) => c.fullName));
});

test('the old admin-only garment seed (ids that never existed on the storefront) is gone', () => {
  const src = readFileSync('src/pages/admin/AdminCollectionsPage.tsx', 'utf8');
  assert.ok(!src.includes('DEFAULT_COLLECTIONS'));
  assert.ok(!/Premium (Tuxedos|Suits|Bomber Jackets)/.test(src));
  assert.ok(!src.includes("localStorage.setItem('LUXARDO FASHION_admin_collections'"), 'the admin page must not seed or write the collections cache itself');
});
