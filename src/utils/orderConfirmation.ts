/** Customer-visible state comes from both payment and fulfilment, never payment alone. */
export interface ConfirmationOrder {
  paymentStatus?: string;
  status?: string;
  rzpOrderCreationState?: string;
}

export function orderConfirmationView(order: ConfirmationOrder) {
  const paid = order.paymentStatus === 'paid';
  const view = (title: string, message: string, success = false) => ({ title, message, success, paid, trackPurchase: success });
  if (order.status === 'cancelled') {
    return paid
      ? view('Order cancelled — payment received', 'Your payment was received, but this order is cancelled and will not be dispatched. Contact support to confirm your refund status.')
      : view('Order cancelled', 'This order is cancelled. If money was deducted, contact support with your order ID.');
  }
  if (order.status === 'on_hold') {
    return view('Order on hold', paid
      ? 'Your payment was received, but this order cannot be prepared yet. Contact support for the resolution and refund status.'
      : 'This order needs review. Contact support before making another payment.');
  }
  if (order.status === 'returned') return view('Order returned', 'This order has been returned. Contact support to confirm the return and refund status.');
  if (order.status === 'failed_delivery') return view('Delivery needs attention', 'Delivery could not be completed. Contact support for the next steps.');
  if (paid) {
    if (order.status === 'delivered') return view('Order delivered', 'Your payment was received and your order has been delivered.', true);
    if (order.status === 'shipped') return view('Order shipped', 'Your payment was received and your order has been shipped.', true);
    if (order.status === 'processing' || order.status === 'packed') return view('Order Placed Successfully!', 'Your payment was received and your order is being prepared.', true);
    return view('Payment received — order under review', 'Your payment was received. Contact support to confirm the order status.');
  }
  if (order.rzpOrderCreationState === 'reconciliation_required' || order.rzpOrderCreationState === 'creating') {
    return view('Payment setup needs review', 'Payment setup has not been confirmed. Do not start another payment; contact support if this persists.');
  }
  return view('Confirming your payment', 'We are waiting for payment confirmation. This page updates automatically. If money was deducted and the status does not update within a few minutes, contact support with your order ID.');
}
