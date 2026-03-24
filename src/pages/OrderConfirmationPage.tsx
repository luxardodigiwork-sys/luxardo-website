import React from 'react';
import { SectionHeader } from '../components/SectionHeader';
import { Link } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';

export default function OrderConfirmationPage() {
  const orderNumber = "LX-" + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');

  return (
    <div className="section-padding max-w-4xl mx-auto min-h-[70vh] text-center">
      <div className="flex justify-center mb-8">
        <CheckCircle className="w-20 h-20 text-brand-black stroke-[1px]" />
      </div>
      
      <SectionHeader 
        title="Order Confirmed" 
        subtitle={`Order #${orderNumber}`} 
      />
      
      <div className="space-y-12 max-w-2xl mx-auto">
        <div className="space-y-6">
          <p className="text-lg font-sans text-brand-black">
            Thank you for choosing LUXARDO. Your order has been successfully placed and is being prepared with the utmost care.
          </p>
          <p className="font-sans text-brand-secondary leading-relaxed">
            A confirmation email has been sent to your inbox. You can track your order status and view your master tailor's blueprint in your account dashboard.
          </p>
        </div>

        <div className="bg-brand-bg p-10 border border-brand-divider space-y-8 text-left">
          <h4 className="text-[11px] uppercase tracking-[0.25em] font-bold text-brand-black border-b border-brand-divider pb-4">What Happens Next</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <h5 className="text-[10px] uppercase tracking-[0.2em] font-bold text-brand-black">1. Expert Refinement</h5>
              <p className="text-xs font-sans text-brand-secondary leading-relaxed">
                Our production team is performing a final inspection of your selected fabric and ready-to-stitch components.
              </p>
            </div>
            <div className="space-y-3">
              <h5 className="text-[10px] uppercase tracking-[0.2em] font-bold text-brand-black">2. Premium Packaging</h5>
              <p className="text-xs font-sans text-brand-secondary leading-relaxed">
                Your garment will be meticulously folded with archival tissue and secured in our signature matte black box.
              </p>
            </div>
            <div className="space-y-3">
              <h5 className="text-[10px] uppercase tracking-[0.2em] font-bold text-brand-black">3. Secure Dispatch</h5>
              <p className="text-xs font-sans text-brand-secondary leading-relaxed">
                Once dispatched, you will receive a tracking number via email and SMS.
              </p>
            </div>
            <div className="space-y-3">
              <h5 className="text-[10px] uppercase tracking-[0.2em] font-bold text-brand-black">4. Tailoring Guidance</h5>
              <p className="text-xs font-sans text-brand-secondary leading-relaxed">
                Your box includes the proprietary LUXARDO Stitch Style Template to guide your local artisan.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6 justify-center pt-8">
          <Link to="/account?tab=orders" className="btn-primary px-12">View Order Status</Link>
          <Link to="/collections" className="px-12 py-4 border border-brand-black text-[11px] uppercase tracking-[0.25em] font-bold hover:bg-brand-black hover:text-brand-white transition-all">Continue Shopping</Link>
        </div>
      </div>
    </div>
  );
}
