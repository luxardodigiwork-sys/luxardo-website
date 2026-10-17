import React, { useState, useEffect } from 'react';
import { formatINR } from '../utils/currency';
import { useParams, Link } from 'react-router-dom';
import { SectionHeader } from '../components/SectionHeader';
import { Package, Truck, CheckCircle, Clock } from 'lucide-react';
import { buildTrackingEvents } from '../utils/trackingEvents';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Order } from '../types';

export default function TrackOrderPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loaded, setLoaded] = useState(false);
  const { user, isAuthReady } = useAuth();

  // Firestore is the only order source; rules let a customer read just their own orders.
  useEffect(() => {
    if (!orderId || !isAuthReady) return;
    if (!user) { setLoaded(true); return; }
    let cancelled = false;
    getDoc(doc(db, 'orders', orderId))
      .then((snap) => {
        if (cancelled) return;
        if (snap.exists() && snap.data().userId === user.id) setOrder({ id: snap.id, ...snap.data() } as unknown as Order);
      })
      .catch((err) => console.error('Failed to load order:', err))
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [orderId, isAuthReady, user]);

  const trackingEvents = order ? buildTrackingEvents(order as any) : [];

  if (!loaded) {
    return <div className="section-padding min-h-[70vh] flex items-center justify-center"><p className="text-brand-secondary">Loading...</p></div>;
  }

  if (!order) {
    return (
      <div className="section-padding max-w-4xl mx-auto min-h-[70vh] text-center flex flex-col items-center justify-center space-y-6">
        <h2 className="text-2xl font-display uppercase tracking-widest">Order Not Found</h2>
        <p className="text-brand-secondary font-sans">We couldn't find an order with ID: {orderId}</p>
        <Link to="/account" className="btn-primary">Go to My Account</Link>
      </div>
    );
  }

  const steps = [
    { id: 'placed', label: 'Order Placed', icon: Clock, completed: true },
    { id: 'processing', label: 'Processing', icon: Package, completed: ['processing', 'packed', 'shipped', 'delivered'].includes(order.status) },
    { id: 'shipped', label: 'Shipped', icon: Truck, completed: ['shipped', 'delivered'].includes(order.status) },
    { id: 'delivered', label: 'Delivered', icon: CheckCircle, completed: order.status === 'delivered' }
  ];

  return (
    <div className="section-padding max-w-4xl mx-auto min-h-[70vh]">
      <SectionHeader 
        title="Track Order" 
        subtitle={`Order #${order.id}`} 
      />

      <div className="mt-12 space-y-12">
        {/* Tracking Timeline Graphic */}
        <div className="bg-brand-bg p-8 md:p-12 border border-brand-divider">
          <div className="relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-brand-divider hidden md:block"></div>
            <div className="flex flex-col md:flex-row justify-between gap-8 relative z-10">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.id} className="flex flex-row md:flex-col items-center gap-4 md:gap-3 text-center">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${
                      step.completed 
                        ? 'bg-brand-black border-brand-black text-brand-white' 
                        : 'bg-brand-white border-brand-divider text-brand-secondary'
                    }`}>
                      <Icon size={20} />
                    </div>
                    <div className="text-left md:text-center">
                      <p className={`text-[10px] uppercase tracking-widest font-bold ${step.completed ? 'text-brand-black' : 'text-brand-secondary'}`}>
                        {step.label}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Detailed Tracking Events */}
          <div className="bg-brand-white border border-brand-divider p-8 space-y-6">
            <h3 className="text-[11px] uppercase tracking-[0.2em] font-bold border-b border-brand-divider pb-4 mb-6">Tracking History</h3>
            
            <div className="space-y-8 relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-brand-divider">
              {trackingEvents.map((event, idx) => (
                <div key={idx} className="relative flex items-start gap-6 md:justify-between">
                  <div className="hidden md:block w-[40%] text-right font-sans">
                     <p className="text-sm font-medium text-brand-black">{event.date}</p>
                     <p className="text-xs text-brand-secondary">{event.time}</p>
                  </div>
                  
                  <div className="absolute left-0 md:relative md:left-auto flex items-center justify-center w-6 h-6 rounded-full bg-brand-black text-brand-white border-4 border-brand-white shrink-0 z-10">
                    {idx === 0 ? <CheckCircle size={12} className="text-brand-white" /> : <div className="w-2 h-2 rounded-full bg-brand-white" />}
                  </div>

                  <div className="pl-10 md:pl-0 w-full md:w-[40%] font-sans">
                    <div className="md:hidden mb-1">
                      <span className="text-xs font-bold text-brand-black mr-2">{event.date}</span>
                      <span className="text-xs text-brand-secondary">{event.time}</span>
                    </div>
                    <h4 className="text-sm font-bold text-brand-black">{event.status}</h4>
                    {event.description && <p className="text-xs text-brand-secondary mt-1">{event.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-brand-white border border-brand-divider p-8 space-y-6">
              <h3 className="text-[11px] uppercase tracking-[0.2em] font-bold border-b border-brand-divider pb-4">Shipping Details</h3>
              <div className="space-y-2 font-sans text-sm text-brand-secondary">
                <p className="font-medium text-brand-black">{order.shippingAddress?.fullName}</p>
                <p>{order.shippingAddress?.addressLine1}</p>
                {order.shippingAddress?.addressLine2 && <p>{order.shippingAddress.addressLine2}</p>}
                <p>{order.shippingAddress?.city}, {order.shippingAddress?.state} {order.shippingAddress?.postalCode}</p>
                <p>{order.shippingAddress?.country}</p>
              </div>
              {order.trackingId && (
                <div className="pt-4 border-t border-brand-divider space-y-2">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-brand-black">Courier Tracking</p>
                  <p className="font-sans text-sm text-brand-secondary">
                    {order.courierName || 'Partner'} - <span className="font-medium text-brand-black">{order.trackingId}</span>
                  </p>
                  {order.trackingUrl && (
                    <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold uppercase tracking-widest underline mt-2 inline-block">
                      Track on Courier Website
                    </a>
                  )}
                </div>
              )}
            </div>

            <div className="bg-brand-white border border-brand-divider p-8 space-y-6">
              <h3 className="text-[11px] uppercase tracking-[0.2em] font-bold border-b border-brand-divider pb-4">Order Summary</h3>
              <div className="space-y-4">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4">
                    <img src={item.image} alt={item.name} className="w-16 h-16 object-cover bg-brand-bg" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs font-sans text-brand-secondary">Qty: {item.quantity}</p>
                    </div>
                    <p className="text-sm font-medium">{formatINR(item.price * item.quantity)}</p>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t border-brand-divider flex justify-between items-center">
                <span className="text-[11px] uppercase tracking-widest font-bold">Total</span>
                <span className="text-lg font-medium">{formatINR(order.totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
