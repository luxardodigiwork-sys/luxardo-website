import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderConfirmationView } from '../src/utils/orderConfirmation';

test('late payment on a cancelled order shows cancellation/refund copy, never preparation or a purchase event', () => {
  const v = orderConfirmationView({ paymentStatus: 'paid', status: 'cancelled' });
  assert.equal(v.paid, true);
  assert.match(v.title, /cancelled/i);
  assert.match(v.message, /refund status/);
  assert.doesNotMatch(v.message, /being prepared/);
  assert.equal(v.success, false);
  assert.equal(v.trackPurchase, false);
});

test('stock-unavailable paid order shows a hold, not a successful preparation message', () => {
  const v = orderConfirmationView({ paymentStatus: 'paid', status: 'on_hold' });
  assert.match(v.title, /hold/i);
  assert.match(v.message, /refund status/);
  assert.equal(v.success, false);
});

test('unpaid cancelled and unresolved orders do not wait on the bank or invite another payment', () => {
  const cancelled = orderConfirmationView({ paymentStatus: 'pending', status: 'cancelled' });
  assert.equal(cancelled.title, 'Order cancelled');
  assert.equal(cancelled.paid, false);
  for (const rzpOrderCreationState of ['creating', 'reconciliation_required']) {
    const v = orderConfirmationView({ paymentStatus: 'pending', status: 'pending', rzpOrderCreationState });
    assert.match(v.message, /Do not start another payment/);
    assert.equal(v.trackPurchase, false);
  }
});

test('only paid fulfilment orders count as successful; shipped/delivered have accurate copy', () => {
  for (const status of ['processing', 'packed', 'shipped', 'delivered']) {
    const v = orderConfirmationView({ paymentStatus: 'paid', status });
    assert.equal(v.success, true);
    assert.equal(v.trackPurchase, true);
  }
  assert.match(orderConfirmationView({ paymentStatus: 'paid', status: 'shipped' }).message, /shipped/);
  for (const status of ['returned', 'failed_delivery', 'unknown']) {
    assert.equal(orderConfirmationView({ paymentStatus: 'paid', status }).success, false);
  }
  assert.equal(orderConfirmationView({ paymentStatus: 'pending', status: 'pending', rzpOrderCreationState: 'ready' }).title, 'Confirming your payment');
});
