import { matchesCollection, collectionLabel, sortCatalogue } from '../src/utils/collectionIdentity';
import { toStorefrontCollections, adminCollectionsFromStorefront } from '../src/utils/contentModel';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, newsletterCsv, subscriberDate } from '../src/utils/newsletterExport';
import { photoDocumentPatch, photoDocumentUrls, publicPhotoPath } from '../src/utils/photoMaintenance';
import { INDIA_COUNTRY, LAUNCH_COUNTRIES } from '../src/utils/launchMarket';
import { photo } from '../src/utils/optimizedImage';

const image = (path: string) => `https://firebasestorage.googleapis.com/v0/b/test-project.firebasestorage.app/o/${encodeURIComponent(path)}?alt=media&token=test-token`;
const old = image('products/original.jpg');
const optimized = image('products/optimized/new.webp');

test('newsletter CSV quotes cells and neutralises formulas from every exported field', () => {
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  for (const value of ['=1+1', '+tag@example.com', '-1', '@SUM(A1)', '  =HYPERLINK("x")', '\tformula']) {
    assert.ok(csvCell(value).startsWith('"\''));
  }
  const csv = newsletterCsv([{ email: '=user@example.com', createdAt: '2026-10-17', status: '+active' }]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /"'=user@example.com"/);
  assert.match(csv, /"'\+active"/);
});

test('newsletter dates support current/legacy timestamps and missing/malformed values', () => {
  assert.equal(subscriberDate(undefined), '');
  assert.equal(subscriberDate(null), '');
  assert.equal(subscriberDate('bad date'), '');
  assert.equal(subscriberDate({ toDate: () => new Date('2026-10-17T00:00:00Z') }), '2026-10-17T00:00:00.000Z');
  assert.match(newsletterCsv([{ email: 'user@example.com', subscribedAt: '2026-10-16' }]), /2026-10-16/);
});

test('photo scan excludes private uploads, resized copies, external sites and non-images', () => {
  for (const url of [image('user-uploads/u1/private.jpg'), image('products/thumbnails/a_800x1200.webp'), image('docs/file.pdf'), 'https://other.example/a.jpg']) assert.equal(publicPhotoPath(url), null);
  assert.equal(publicPhotoPath(old), 'products/original.jpg');
  assert.deepEqual(photoDocumentUrls('siteContent', { json: JSON.stringify({ hero: { image: old }, private: image('user-uploads/u1/me.jpg') }) }), [old]);
});

test('photo replacement patches only allowed photo fields, never price, stock or unrelated text', () => {
  const data = { image: old, images: [old], price: 1999, stock: 2, name: old, updatedAt: 'keep' };
  assert.deepEqual(photoDocumentPatch('products', data, new Map([[old, optimized]])), { image: optimized, images: [optimized] });
  assert.deepEqual(photoDocumentPatch('orders', data, new Map([[old, optimized]])), {});
  const fresh = image('products/concurrent-new.jpg');
  assert.deepEqual(photoDocumentPatch('products', { image: fresh, stock: 1 }, new Map([[old, optimized]])), {});
});

test('published JSON gets exact URL replacement while preserving current text and malformed JSON', () => {
  const data = { json: JSON.stringify({ hero: { image: old }, text: 'current text', count: 3 }) };
  const result = photoDocumentPatch('siteContent', data, new Map([[old, optimized]]));
  assert.deepEqual(JSON.parse(result.json as string), { hero: { image: optimized }, text: 'current text', count: 3 });
  assert.deepEqual(photoDocumentPatch('siteContent', { json: '{broken' }, new Map([[old, optimized]])), {});
  assert.deepEqual(photoDocumentPatch('products', { image: old }, new Map([[old, image('user-uploads/u1/private.jpg')]])), {});
});

test('launch market is India only, leaving the global country list outside active launch settings', () => {
  assert.equal(INDIA_COUNTRY.code, 'IN');
  assert.deepEqual(LAUNCH_COUNTRIES.map(country => country.code), ['IN']);
  assert.equal(INDIA_COUNTRY.currency.code, 'INR');
});

test('responsive photo fallback clears a missing thumbnail srcset and never loops on the original', () => {
  const props = photo(old, 'full');
  assert.match(props.srcSet!, /800w/);
  assert.equal(props.src, old);
  const attrs: Record<string, string> = { src: old, srcset: props.srcSet!, sizes: props.sizes! };
  let writes = 0;
  const element = { getAttribute: (name: string) => attrs[name] ?? null, removeAttribute: (name: string) => { delete attrs[name]; }, set src(value: string) { writes++; attrs.src = value; } };
  props.onError!({ currentTarget: element as unknown as HTMLImageElement });
  assert.equal(attrs.src, old); assert.equal(attrs.srcset, undefined);
  props.onError!({ currentTarget: element as unknown as HTMLImageElement });
  assert.equal(writes, 1);
  assert.equal(photo(image('user-uploads/u1/me.jpg'), 'full').srcSet, undefined);
});


test('collection matching accepts legacy case/name/slug and stable IDs without broad category matches', () => {
  const collection = { id: 'casual', categoryId: 'stable-123', fullName: 'Casual', shortName: 'Casual' };
  for (const category of ['CASUAL', ' casual ', 'stable-123']) assert.equal(matchesCollection(category, collection), true);
  assert.equal(matchesCollection('casual-shirts', collection), false);
  assert.equal(matchesCollection('', collection), false);
  assert.equal(matchesCollection('Casual', undefined), false);
  assert.equal(collectionLabel('stable-123', [collection]), 'Casual');
});

test('collection publishing keeps stable category identity through name and URL changes', () => {
  const list = [{ id: 'stable-123', name: 'New Name', slug: 'new-url', shortDescription: '', longDescription: '', bannerImageUrl: '', heroImageUrl: '', isVisible: true, sortOrder: 1 }];
  const storefront = toStorefrontCollections(list);
  assert.equal(storefront[0].id, 'new-url');
  assert.equal(storefront[0].categoryId, 'stable-123');
  assert.equal(matchesCollection('stable-123', storefront[0]), true);
  assert.equal(adminCollectionsFromStorefront(storefront)[0].id, 'stable-123');
});

test('catalogue sorting uses real dates, price and featured metadata without mutating the source', () => {
  const items = [{ id: 'old', price: 300, createdAt: '2026-01-01', featured: true }, { id: 'new', price: 100, createdAt: '2026-10-17' }];
  assert.deepEqual(sortCatalogue(items, 'newest').map(item => item.id), ['new', 'old']);
  assert.deepEqual(sortCatalogue(items, 'price-low').map(item => item.id), ['new', 'old']);
  assert.deepEqual(sortCatalogue(items, 'price-high').map(item => item.id), ['old', 'new']);
  assert.deepEqual(sortCatalogue(items, 'featured').map(item => item.id), ['old', 'new']);
  assert.equal(items[0].id, 'old');
});
