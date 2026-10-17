import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as ns from '../src/utils/analytics';

const m: any = (ns as any).default ?? ns;

test('ID validation: only real GA4 / Pixel id shapes are accepted', () => {
  assert.equal(m.isValidGaId('G-ABCD123456'), true);
  for (const bad of ['UA-12345-1', 'G-', 'ABCD123456', '', 'G-ab<script>']) assert.equal(m.isValidGaId(bad), false);
  assert.equal(m.isValidPixelId('1234567890123456'), true);
  for (const bad of ['12', 'abc', '123456789012345678901234', '']) assert.equal(m.isValidPixelId(bad), false);
});

test('staff areas are never tracked', () => {
  for (const p of ['/admin', '/admin/dashboard', '/owner/dashboard', '/dispatch', '/backend/login', '/analysis/x']) assert.equal(m.isStaffPath(p), true);
  for (const p of ['/', '/collections', '/product/1', '/administer']) assert.equal(m.isStaffPath(p), false);
});

test('GA4 mapping uses INR and item fields; purchase carries the transaction id', () => {
  const g = m.mapToGa('purchase', { value: 1999, transactionId: 'o1', items: [{ id: 'p1', name: 'Shirt', price: 1999, quantity: 1 }] });
  assert.equal(g.name, 'purchase');
  assert.deepEqual(g.data, { currency: 'INR', value: 1999, items: [{ item_id: 'p1', item_name: 'Shirt', price: 1999, quantity: 1 }], transaction_id: 'o1' });
  assert.equal(m.mapToGa('page_view', { path: '/x' }).data.page_path, '/x');
});

test('Meta mapping: standard event names, content ids and item counts', () => {
  const items = [{ id: 'a', quantity: 2 }, { id: 'b' }];
  assert.equal(m.mapToMeta('view_item', { items }).name, 'ViewContent');
  assert.equal(m.mapToMeta('add_to_cart', { items }).name, 'AddToCart');
  const co = m.mapToMeta('begin_checkout', { value: 10, items });
  assert.equal(co.name, 'InitiateCheckout');
  assert.equal(co.data.num_items, 3);
  assert.deepEqual(co.data.content_ids, ['a', 'b']);
  assert.equal(m.mapToMeta('purchase', { value: 10, items }).name, 'Purchase');
  assert.deepEqual(m.mapToMeta('page_view', {}), { name: 'PageView' });
});

test('without consent / ids / a browser, track and init do nothing and never throw', () => {
  assert.doesNotThrow(() => m.track('purchase', { value: 1 }));
  assert.doesNotThrow(() => m.initAnalytics());
  assert.equal(m.getConsent(), null);
  assert.equal(m.trackingConfigured(), false);
});
