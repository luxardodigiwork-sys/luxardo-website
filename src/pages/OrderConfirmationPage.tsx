import React, { useEffect } from 'react';
import { SectionHeader } from '../components/SectionHeader';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';

export default function OrderConfirmationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const order = location.state?.order;

  // Redirect home if someone opens this page directly
  useEffect(() => {
    if (!order) {
      const timer = setTimeout(() => navigate('/'), 3000);
      return () => clearTimeout(timer);
    }
  }, [order, navigate]);

  if (!order) {
    return (
      <div className="section-padding min-h-[70vh] max-w-4xl mx-auto text-center flex flex-col items-center justify-center gap-4">
        <p className="text-lg text-brand-secondary">No order found. Redirecting to home...</p>
      </div>
    );
  }

  // Use last 8 chars of Firestore document ID as display order number
  const displayOrderId = "LX-" + order.id.slice(-8).toUpperCase();

  return (
    <div className="section-padding max-w-4xl mx-auto min-h-[70vh] text-center">
      <div className="flex justify-center mb-8">
        <CheckCircle className="w-20 h-20 text-green-600 stroke-[1px]" />
      </div>

      <SectionHeader
        title="Order Placed Successfully!"
        subtitle={`Order ID: ${displayOrderId}`}
      />

      <div className="space-y-10 max-w-2xl mx-auto mt-8">
        <div className="space-y-4">
          <p className="text-lg font-sans text-brand-black">
            Thank you for choosing <strong>LUXARDO</strong>. Your order{' '}
            <span className="font-bold">{displayOrderId}</span> has been placed and
            is being prepared with care.
          </p>
          <p className="font-sans text-brand-secondary leading-relaxed">
            We will contact you at{' '}
            <strong>{order.customer?.phone || order.shippingAddress?.phone}</strong>{' '}
            to confirm delivery. Shipped via DTDC within 2–3 business days.
          </p>
        </div>

        {/* Order Summary Box */}
        <div className="bg-brand-bg p-8 border border-brand-divider rounded-2xl text-left space-y-6">
          <h4 className="text-[11px] uppercase tracking-[0.25em] font-bold text-brand-black border-b border-brand-divider pb-4">
            Order Summary
          </h4>

          {/* Customer */}
          <div className="space-y-1 text-sm">
            <p className="font-semibold">{order.shippingAddress?.fullName}</p>
            <p className="text-brand-secondary">{order.shippingAddress?.email}</p>
            <p className="text-brand-secondary">{order.shippingAddress?.phone}</p>
          </div>

          {/* Shipping Address */}
          <div className="space-y-1 text-sm border-t border-brand-divider pt-4">
            <p className="text-[11px] uppercase tracking-widest font-bold text-brand-secondary mb-2">
              Delivery To
            </p>
            <p>{order.shippingAddress?.addressLine1}</p>
            {order.shippingAddress?.addressLine2 && (
              <p>{order.shippingAddress.addressLine2}</p>
            )}
            <p>
              {order.shippingAddress?.city}, {order.shippingAddress?.state}{' '}
              – {order.shippingAddress?.postalCode}
            </p>
          </div>

          {/* Items */}
          {order.items && order.items.length > 0 && (
            <div className="space-y-2 border-t border-brand-divider pt-4">
              <p className="text-[11px] uppercase tracking-widest font-bold text-brand-secondary mb-2">
                Items Ordered
              </p>
              {order.items.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span>
                    {item.title} × {item.quantity}
                    {item.size && item.size !== 'N/A' ? ` (${item.size})` : ''}
                  </span>
                  <span className="font-medium">
                    ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Totals */}
          <div className="space-y-2 border-t border-brand-divider pt-4">
            <div className="flex justify-between text-sm">
              <span className="text-brand-secondary">Shipping</span>
              <span className="text-green-600 font-medium">Free</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-brand-secondary">Payment Method</span>
              <span className="font-medium">Cash on Delivery (COD)</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-brand-secondary">Estimated Delivery</span>
              <span className="font-medium">5–7 Business Days</span>
            </div>
            <div className="flex justify-between text-base font-semibold border-t border-brand-divider pt-3">
              <span>Total</span>
              <span>₹{order.totalAmount?.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col md:flex-row gap-4 justify-center pt-4">
          <Link to="/collections" className="btn-primary px-12 py-4">
            Continue Shopping
          </Link>
          <Link
            to="/account"
            className="btn-outline px-12 py-4 text-[11px] uppercase tracking-[0.25em]"
          >
            View My Orders
          </Link>
        </div>

        <p className="text-xs text-brand-secondary">
          For queries:{' '}
          <a href="mailto:support@luxardofashion.com" className="underline">
            support@luxardofashion.com
          </a>
        </p>
      </div>
    </div>
  );
}
