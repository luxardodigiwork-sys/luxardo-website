import React, { useEffect, useState } from 'react';
import { SectionHeader } from '../components/SectionHeader';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Clock } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { formatINR } from '../utils/currency';
import { track } from '../utils/analytics';
import { orderConfirmationView } from '../utils/orderConfirmation';

/**
 * Shows the order from Firestore (the single source of truth). "Placed" is only displayed once the
 * server has verified a captured payment; until then the customer sees "confirming payment".
 */
export default function OrderConfirmationPage() {
  const [params] = useSearchParams();
  const orderId = params.get('order');
  const navigate = useNavigate();
  const { isAuthReady, user } = useAuth();
  const [order, setOrder] = useState<any | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');

  useEffect(() => {
    if (!orderId) { setState('missing'); return; }
    if (!isAuthReady) return;
    if (!user) { navigate('/login', { replace: true, state: { from: { pathname: `/order-confirmation`, search: `?order=${orderId}` } } }); return; }
    return onSnapshot(
      doc(db, 'orders', orderId),
      (snap) => { if (snap.exists()) { setOrder({ id: snap.id, ...snap.data() }); setState('ready'); } else setState('missing'); },
      () => setState('missing'),
    );
  }, [orderId, isAuthReady, user, navigate]);

  useEffect(() => {
    if (!order || !orderConfirmationView(order).trackPurchase) return;
    const key = `LUXARDO_purchase_${order.id}`;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch {}
    track('purchase', { transactionId: order.id, value: Number(order.totalAmount) || 0, items: (order.items || []).map((i: any) => ({ id: String(i.productId), name: i.name || i.title, price: i.price, quantity: i.quantity })) });
  }, [order?.id, order?.paymentStatus, order?.status]);

  if (state === 'loading') {
    return <div className="section-padding min-h-[70vh] flex items-center justify-center"><p className="text-brand-secondary">Loading your order...</p></div>;
  }
  if (state === 'missing' || !order) {
    return (
      <div className="section-padding min-h-[70vh] max-w-4xl mx-auto text-center flex flex-col items-center justify-center gap-4">
        <p className="text-lg text-brand-secondary">We could not find this order.</p>
        <Link to="/account" className="btn-outline px-8 py-3">View My Orders</Link>
      </div>
    );
  }

  const view = orderConfirmationView(order);
  const paid = view.paid;
  const displayOrderId = 'LX-' + order.id.slice(-8).toUpperCase();

  return (
    <div className="section-padding max-w-4xl mx-auto min-h-[70vh] text-center">
      <div className="flex justify-center mb-8">
        {view.success ? <CheckCircle className="w-20 h-20 text-green-600 stroke-[1px]" /> : <Clock className="w-20 h-20 text-amber-600 stroke-[1px]" />}
      </div>

      <SectionHeader
        title={view.title}
        subtitle={`Order ID: ${displayOrderId}`}
      />

      <div className="space-y-10 max-w-2xl mx-auto mt-8">
        <div className="space-y-4">
          <p className="text-lg font-sans text-brand-black">{view.message}</p>
          <p className="text-sm text-brand-secondary">
            Your order contains Ready-to-Stitch fabric; stitching is not included.
          </p>
        </div>

        <div className="bg-brand-bg p-8 border border-brand-divider rounded-2xl text-left space-y-6">
          <h4 className="text-[11px] uppercase tracking-[0.25em] font-bold text-brand-black border-b border-brand-divider pb-4">Order Summary</h4>
          <div className="space-y-1 text-sm">
            <p className="font-semibold">{order.shippingAddress?.fullName}</p>
            <p className="text-brand-secondary">{order.shippingAddress?.email}</p>
            <p className="text-brand-secondary">{order.shippingAddress?.phone}</p>
          </div>
          <div className="space-y-1 text-sm border-t border-brand-divider pt-4">
            <p className="text-[11px] uppercase tracking-widest font-bold text-brand-secondary mb-2">Delivery To</p>
            <p>{order.shippingAddress?.addressLine1}</p>
            {order.shippingAddress?.addressLine2 && <p>{order.shippingAddress.addressLine2}</p>}
            <p>{order.shippingAddress?.city}, {order.shippingAddress?.state} – {order.shippingAddress?.postalCode}</p>
          </div>
          {order.items?.length > 0 && (
            <div className="space-y-2 border-t border-brand-divider pt-4">
              <p className="text-[11px] uppercase tracking-widest font-bold text-brand-secondary mb-2">Items Ordered</p>
              {order.items.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span>{item.title || item.name} × {item.quantity}{item.size ? ` (${item.size})` : ''}</span>
                  <span className="font-medium">{formatINR(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-2 border-t border-brand-divider pt-4">
            <div className="flex justify-between text-sm">
              <span className="text-brand-secondary">Shipping</span>
              <span className="text-green-600 font-medium">{(order.shippingAmount ?? 0) === 0 ? 'Free' : formatINR(order.shippingAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-brand-secondary">Payment</span>
              <span className="font-medium">{paid ? 'Paid online (Razorpay)' : 'Awaiting confirmation'}</span>
            </div>
            <div className="flex justify-between text-base font-semibold border-t border-brand-divider pt-3">
              <span>Total</span>
              <span>{formatINR(order.totalAmount)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 justify-center pt-4">
          <Link to="/collections" className="btn-primary px-12 py-4">Continue Shopping</Link>
          <Link to="/account" className="btn-outline px-12 py-4 text-[11px] uppercase tracking-[0.25em]">View My Orders</Link>
        </div>
      </div>
    </div>
  );
}
