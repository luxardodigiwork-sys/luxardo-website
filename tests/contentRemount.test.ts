import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as ns from '../src/utils/contentRemount';
const M: any = (ns as any).default ?? ns;

test('checkout, cart, account, login and order pages never accept a remount-causing update', () => {
  for (const p of ['/checkout', '/checkout/', '/cart', '/account', '/account/orders/abc', '/login', '/order-confirmation', '/prime-membership/checkout']) {
    assert.equal(M.isRemountProtectedPath(p), true, p);
    assert.equal(M.canApplyContentUpdateNow({ pathname: p, userTyped: false, fieldFocused: false }), false, p);
  }
});
test('ordinary pages accept an update unless the visitor has typed or a field is focused', () => {
  assert.equal(M.canApplyContentUpdateNow({ pathname: '/', userTyped: false, fieldFocused: false }), true);
  assert.equal(M.canApplyContentUpdateNow({ pathname: '/contact', userTyped: true, fieldFocused: false }), false);
  assert.equal(M.canApplyContentUpdateNow({ pathname: '/contact', userTyped: false, fieldFocused: true }), false);
});
test('path matching is prefix-safe', () => {
  assert.equal(M.isRemountProtectedPath('/cartography'), false);
  assert.equal(M.isRemountProtectedPath('/accounting'), false);
  assert.equal(M.isRemountProtectedPath('/collections/x'), false);
});
test('isEditableElement recognises form fields only', () => {
  assert.equal(M.isEditableElement({ tagName: 'INPUT' }), true);
  assert.equal(M.isEditableElement({ tagName: 'TEXTAREA' }), true);
  assert.equal(M.isEditableElement({ tagName: 'DIV', isContentEditable: true }), true);
  assert.equal(M.isEditableElement({ tagName: 'DIV' }), false);
  assert.equal(M.isEditableElement(null), false);
});
