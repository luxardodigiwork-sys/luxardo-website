import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as ns from '../src/utils/optimizedImage';

const m: any = (ns as any).default ?? ns;
const B = 'luxardo-fashion-website.firebasestorage.app';
const url = (path: string) => `https://firebasestorage.googleapis.com/v0/b/${B}/o/${encodeURIComponent(path)}?alt=media&token=abc`;

test('maps a product image to its thumbnails/…_800x1200.webp copy (token dropped)', () => {
  const r = m.resizedImageUrl(url('products/1700_shirt.jpg'));
  assert.equal(r, `https://firebasestorage.googleapis.com/v0/b/${B}/o/${encodeURIComponent('products/thumbnails/1700_shirt_800x1200.webp')}?alt=media`);
});

test('works for root-level files and png/webp', () => {
  assert.ok(m.resizedImageUrl(url('a.png'))!.includes(encodeURIComponent('thumbnails/a_800x1200.webp')));
  assert.ok(m.resizedImageUrl(url('x/b.webp'))!.includes(encodeURIComponent('x/thumbnails/b_800x1200.webp')));
});

test('leaves non-Firebase, non-image, already-resized and private URLs alone', () => {
  assert.equal(m.resizedImageUrl('https://images.unsplash.com/photo-1?w=800'), undefined);
  assert.equal(m.resizedImageUrl(url('docs/invoice.pdf')), undefined);
  assert.equal(m.resizedImageUrl(url('products/thumbnails/a_800x1200.webp')), undefined);
  assert.equal(m.resizedImageUrl(url('user-uploads/u1/me.png')), undefined);
  assert.equal(m.resizedImageUrl(undefined), undefined);
  assert.equal(m.resizedImageUrl('not a url'), undefined);
});
