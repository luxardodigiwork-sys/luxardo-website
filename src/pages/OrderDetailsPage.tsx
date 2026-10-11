import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChevronLeft, Package, MapPin, CreditCard, Truck, CheckCircle2, Circle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatINR } from '../utils/currency';
import { evaluateCancellation } from '../utils/cancellation';
import { requestOrderCancellation } from '../utils/payments';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Order } from '../types';

export default function OrderDetailsPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [cancelState, setCancelState] = useState<'idle' | 'confirm' | 'working' | 'done_cancelled' | 'done_requested' | 'error'>('idle');
  const [cancelError, setCancelError] = useState('');

  const handleCancel = async () => {
    setCancelState('working');
    setCancelError('');
    try {
      const res = await requestOrderCancellation(order.id);
      setCancelState(res.outcome === 'cancelled' ? 'done_cancelled' : 'done_requested');
    } catch (err: any) {
      setCancelError(err?.message || 'Could not cancel this order online.');
      setCancelState('error');
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        // Firestore is the only order source; rules let a customer read just their own orders.
        const snap = await getDoc(doc(db, 'orders', orderId as string));
        if (cancelled) return;
        if (!snap.exists() || snap.data().userId !== user.id) { navigate('/account?tab=orders'); return; }
        const o: any = { id: snap.id, ...snap.data() };
        const paid = o.paymentStatus === 'paid' || o.paymentStatus === 'confirmed';
        setOrder({
          ...o,
          date: new Date(o.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          rawPaymentStatus: o.paymentStatus, // the label below replaces paymentStatus for display
          paymentStatus: paid ? 'Paid' : o.paymentStatus === 'failed' ? 'Failed' : o.paymentStatus === 'refunded' ? 'Refunded' : 'Awaiting payment',
          total: formatINR(o.totalAmount),
          subtotal: formatINR(o.subtotalAmount ?? o.totalAmount),
          shipping: (o.shippingAmount ?? 0) === 0 ? 'Free' : formatINR(o.shippingAmount),
          // Tax is only shown when the order actually carries a recorded tax amount (GST treatment is unconfirmed).
          tax: typeof o.taxAmount === 'number' ? formatINR(o.taxAmount) : null,
          paymentMethod: 'Razorpay (online)',
          paymentReference: o.razorpayPaymentId || '—',
          items: (o.items || []).map((item: any) => ({
            ...item,
            name: item.name || item.title,
            price: formatINR(item.price),
            image: item.image || undefined,
            format: 'Ready-to-Stitch Fabric',
          })),
          contactInfo: {
            email: o.shippingAddress?.email || o.userEmail,
            phone: o.shippingAddress?.phone || '',
          },
          deliveryMethod: 'Standard Delivery',
          trackingNumber: o.trackingId || null,
        });
      } catch (err) {
        console.error('Failed to load order:', err);
        if (!cancelled) navigate('/account?tab=orders');
      }
    })();
    return () => { cancelled = true; };
  }, [orderId, user, navigate]);

  if (!user || !order) return null;

  const standardTimeline = ['processing', 'confirmed', 'shipped', 'delivered'];
  const cancelledTimeline = ['processing', 'cancelled'];
  
  const currentTimeline = order.status === 'cancelled' ? cancelledTimeline : standardTimeline;
  const currentStatusIndex = currentTimeline.indexOf(order.status);

  return (
    <div className="min-h-screen bg-brand-bg pt-32 pb-20">
      <div className="max-w-3xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-12"
        >
          {/* 1. Header */}
          <div className="space-y-6">
            <Link 
              to="/account?tab=orders" 
              className="inline-flex items-center gap-2 text-[11px] uppercase tracking-widest font-bold text-brand-secondary hover:text-brand-black transition-colors"
            >
              <ChevronLeft size={14} /> Back to Orders
            </Link>
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-6 border-b border-brand-divider">
              <div className="space-y-2">
                <h1 className="text-4xl font-display tracking-tight">Order #{order.id}</h1>
                <p className="font-sans text-brand-secondary">Placed on {order.date}</p>
              </div>
              <div className="flex gap-4">
                <div className="px-4 py-2 border border-brand-divider bg-brand-white text-center min-w-[100px]">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary mb-1">Status</p>
                  <p className="font-sans text-brand-black font-medium">{order.status}</p>
                </div>
                <div className="px-4 py-2 border border-brand-divider bg-brand-white text-center min-w-[100px]">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary mb-1">Payment</p>
                  <p className="font-sans text-brand-black font-medium">{order.paymentStatus}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Ordered Items */}
          <section className="space-y-6">
            <h2 className="text-[11px] uppercase tracking-widest font-bold text-brand-black">Ordered Items</h2>
            <div className="bg-brand-white border border-brand-divider p-6 space-y-6">
              {order.items.map((item: any, idx: number) => (
                <div key={idx} className="flex gap-6 pb-6 border-b border-brand-divider last:border-0 last:pb-0">
                  <div className="w-24 h-32 bg-brand-bg overflow-hidden flex-shrink-0">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start">
                        <h3 className="font-display text-xl">{item.name}</h3>
                        <p className="font-sans font-medium">{item.price}</p>
                      </div>
                      <div className="mt-2 space-y-1">
                        <p className="text-sm font-sans text-brand-secondary">Format: <span className="text-brand-black">{item.format}</span></p>
                        <p className="text-sm font-sans text-brand-secondary">Qty: <span className="text-brand-black">{item.quantity}</span></p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 3. Delivery Details */}
          <section className="space-y-6">
            <h2 className="text-[11px] uppercase tracking-widest font-bold text-brand-black">Delivery Details</h2>
            <div className="bg-brand-white border border-brand-divider p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary">Shipping Address</p>
                <div className="font-sans text-brand-black text-sm leading-relaxed">
                  <p className="font-medium">{order.shippingAddress?.fullName || order.userName}</p>
                  <p>{order.shippingAddress?.addressLine1}</p>
                  {order.shippingAddress?.addressLine2 && <p>{order.shippingAddress.addressLine2}</p>}
                  <p>{order.shippingAddress?.city}, {order.shippingAddress?.state} {order.shippingAddress?.postalCode}</p>
                  <p>{order.shippingAddress?.country}</p>
                </div>
              </div>
              <div className="space-y-6">
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary">Contact Info</p>
                  <div className="font-sans text-brand-black text-sm leading-relaxed">
                    <p>{order.contactInfo.email}</p>
                    <p>{order.contactInfo.phone}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 4. Payment Summary */}
          <section className="space-y-6">
            <h2 className="text-[11px] uppercase tracking-widest font-bold text-brand-black">Payment Summary</h2>
            <div className="bg-brand-white border border-brand-divider p-6">
              <div className="space-y-4 font-sans text-sm pb-6 border-b border-brand-divider">
                <div className="flex justify-between text-brand-secondary">
                  <span>Subtotal</span>
                  <span className="text-brand-black">{order.subtotal}</span>
                </div>
                <div className="flex justify-between text-brand-secondary">
                  <span>Shipping</span>
                  <span className="text-brand-black">{order.shipping}</span>
                </div>
                {order.tax && (
                  <div className="flex justify-between text-brand-secondary">
                    <span>Tax</span>
                    <span className="text-brand-black">{order.tax}</span>
                  </div>
                )}
              </div>
              
              <div className="py-6 border-b border-brand-divider flex justify-between font-medium text-brand-black text-lg">
                <span>Total</span>
                <span>{order.total}</span>
              </div>

              <div className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary mb-1">Payment Method</p>
                  <p className="font-sans text-sm text-brand-black">{order.paymentMethod}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary mb-1">Payment Reference</p>
                  <p className="font-sans text-sm text-brand-black">{order.paymentReference}</p>
                </div>
              </div>
            </div>
          </section>

          {/* 5. Order Actions */}
          <section className="space-y-6">
            <h2 className="text-[11px] uppercase tracking-widest font-bold text-brand-black">Order Actions</h2>
            <div className="grid grid-cols-1 gap-4">
              <button
                onClick={() => navigate('/account?tab=orders')}
                className="btn-outline w-full py-4"
              >
                Track Order
              </button>
            </div>
            {(() => {
              const verdict = evaluateCancellation({ ...order, paymentStatus: order.rawPaymentStatus });
              if (cancelState === 'done_cancelled') {
                return <p className="text-sm font-sans text-brand-black">Your order has been cancelled.</p>;
              }
              if (cancelState === 'done_requested' || order.cancellationRequest) {
                return (
                  <p className="text-sm font-sans text-brand-black">
                    Your cancellation request has been received. We will review it and, if it is approved, refund the payment to the original payment method. The request is not a confirmed cancellation until we approve it.
                  </p>
                );
              }
              if (!verdict.allowed) {
                return <p className="text-xs font-sans text-brand-secondary">{verdict.reason} To change an order, please contact our support team with your order number.</p>;
              }
              return (
                <div className="space-y-3">
                  {cancelState === 'confirm' || cancelState === 'working' || cancelState === 'error' ? (
                    <>
                      <p className="text-sm font-sans text-brand-black">
                        {verdict.mode === 'cancel_unpaid'
                          ? 'Cancel this unpaid order?'
                          : 'Request cancellation of this paid order? Cancellation requests are accepted within 24 hours of placing the order and are subject to approval.'}
                      </p>
                      {cancelError && <p className="text-xs text-red-700">{cancelError}</p>}
                      <div className="flex gap-3">
                        <button type="button" disabled={cancelState === 'working'} onClick={handleCancel} className="btn-primary px-6 py-3 disabled:opacity-50">
                          {cancelState === 'working' ? 'Sending...' : 'Yes, continue'}
                        </button>
                        <button type="button" disabled={cancelState === 'working'} onClick={() => setCancelState('idle')} className="btn-outline px-6 py-3">No, keep my order</button>
                      </div>
                    </>
                  ) : (
                    <button type="button" onClick={() => setCancelState('confirm')} className="btn-outline w-full py-4">
                      {verdict.mode === 'cancel_unpaid' ? 'Cancel order' : 'Request cancellation'}
                    </button>
                  )}
                </div>
              );
            })()}
          </section>

          {/* 6. Status Timeline */}
          <section className="space-y-6">
            <h2 className="text-[11px] uppercase tracking-widest font-bold text-brand-black">Status Timeline</h2>
            <div className="bg-brand-white border border-brand-divider p-8">
              <div className="relative">
                {/* Vertical Line */}
                <div className="absolute left-[11px] top-2 bottom-2 w-[1px] bg-brand-divider"></div>
                
                <div className="space-y-8">
                  {currentTimeline.map((step, idx) => {
                    const isCompleted = currentStatusIndex >= idx;
                    const isCurrent = currentStatusIndex === idx;
                    const isCancelled = step === 'cancelled';
                    
                    return (
                      <div key={step} className="relative flex items-start gap-6">
                        <div className="relative z-10 bg-brand-white py-1">
                          {isCompleted ? (
                            <CheckCircle2 size={24} className={isCancelled ? "text-red-500" : "text-brand-black"} />
                          ) : (
                            <Circle size={24} className="text-brand-divider" />
                          )}
                        </div>
                        <div className="pt-1">
                          <p className={`font-sans font-medium ${isCompleted ? (isCancelled ? 'text-red-500' : 'text-brand-black') : 'text-brand-secondary'}`}>
                            {step}
                          </p>
                          {isCurrent && order.status === 'cancelled' && (
                            <div className="mt-2 space-y-1 text-sm font-sans text-brand-secondary">
                              <p>Date: {order.cancellationDate}</p>
                              <p>Reason: {order.cancellationReason}</p>
                              <p className="mt-2 text-brand-black">{order.refundNote}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

        </motion.div>
      </div>
    </div>
  );
}
