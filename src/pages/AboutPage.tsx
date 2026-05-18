import React from "react";
import { ShieldCheck, Box, Scissors, Building2, Mail, Phone, FileText } from "lucide-react";

export default function AboutUs() {
  return (
    <div className="bg-white text-neutral-900 font-sans min-h-screen pt-24 pb-16 px-4 md:px-8 max-w-[1400px] mx-auto selection:bg-neutral-900 selection:text-white">
      
      {/* Hero Header Section */}
      <div className="text-center max-w-3xl mx-auto mb-16 md:mb-24">
        <span className="text-[10px] tracking-[0.4em] text-neutral-400 uppercase font-bold block mb-3">
          Maison Identity
        </span>
        <h1 className="text-3xl md:text-5xl font-light tracking-[0.2em] text-neutral-900 uppercase mb-6">
          About Us
        </h1>
        <div className="h-[1px] w-12 bg-neutral-300 mx-auto mb-6"></div>
        <p className="text-xl italic font-serif text-neutral-600 tracking-wide">
          "Constructed With Intent."
        </p>
      </div>

      {/* Core Operations & Bhilwara Legacy */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center border-b border-neutral-100 pb-16 mb-16">
        <div className="space-y-6">
          <h2 className="text-xl md:text-2xl font-light tracking-widest text-neutral-950 uppercase">
            The Hub of Excellence
          </h2>
          <p className="text-neutral-600 text-sm md:text-base font-light leading-relaxed">
            At <strong>LUXARDO FASHION</strong>, transparency and structural integrity define our core operations. Our entire ecosystem is centrally consolidated to maintain absolute quality control over every thread that leaves our facility. 
          </p>
          <p className="text-neutral-600 text-sm md:text-base font-light leading-relaxed">
            Our corporate <strong>Company Compliance Management</strong>, high-performance <strong>Dispatch Channels</strong>, and our state-of-the-art <strong>Production House</strong> are proudly located and operated entirely out of <strong>Bhilwara, Rajasthan</strong> — the legendary textile heart capital of India.
          </p>
        </div>
        <div className="bg-neutral-50 p-8 border border-neutral-100 rounded-sm grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col items-center text-center p-4">
            <Building2 size={28} className="text-neutral-800 mb-3 font-light" />
            <h4 className="text-xs tracking-wider uppercase font-semibold mb-1 text-neutral-900">Compliance</h4>
            <p className="text-[11px] text-neutral-500 font-light">Centralized Corporate Governance</p>
          </div>
          <div className="flex flex-col items-center text-center p-4">
            <Scissors size={28} className="text-neutral-800 mb-3 font-light" />
            <h4 className="text-xs tracking-wider uppercase font-semibold mb-1 text-neutral-900">Production</h4>
            <p className="text-[11px] text-neutral-500 font-light">Artisan Handwork House</p>
          </div>
          <div className="flex flex-col items-center text-center p-4">
            <Box size={28} className="text-neutral-800 mb-3 font-light" />
            <h4 className="text-xs tracking-wider uppercase font-semibold mb-1 text-neutral-900">Dispatch</h4>
            <p className="text-[11px] text-neutral-500 font-light">PAN India Secure Shipping</p>
          </div>
        </div>
      </div>

      {/* The Customer Ecosystem: Standard vs Prime */}
      <div className="mb-20">
        <div className="text-center mb-12">
          <h2 className="text-xl md:text-2xl font-light tracking-widest text-neutral-950 uppercase">
            Our Client Operational Pathways
          </h2>
          <p className="text-xs text-neutral-400 uppercase tracking-widest mt-2">
            Tailored structures for the modern gentleman
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          {/* Pathway 1: Standard Customer */}
          <div className="border border-neutral-200/80 p-8 md:p-10 rounded-sm hover:border-neutral-900 transition-colors duration-300 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-6">
                <span className="text-[10px] tracking-[0.3em] font-bold text-neutral-400 uppercase">
                  Pathway 01
                </span>
                <span className="bg-neutral-100 text-neutral-800 text-[10px] font-medium tracking-widest uppercase px-2.5 py-1 rounded-full">
                  Standard Experience
                </span>
              </div>
              <h3 className="text-lg md:text-xl font-light tracking-wider uppercase text-neutral-900 mb-4">
                Ready-to-Stitch Premium Luxury
              </h3>
              <p className="text-neutral-600 text-sm font-light leading-relaxed mb-6">
                Designed for direct digital visitors looking for immaculate fabric depth and elite aesthetics without structural delays.
              </p>
              <ul className="space-y-3 text-neutral-600 text-xs font-light">
                <li className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-neutral-900 rounded-full"></div>
                  Premium unstitched suitings, shirtings, and ethnic wear fabrics.
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-neutral-900 rounded-full"></div>
                  Pre-designed intricate handwork and structural embroidery by master artisans.
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-neutral-900 rounded-full"></div>
                  Delivered exclusively in our ultra-premium **Maison Box Packing** shield.
                </li>
              </ul>
            </div>
          </div>

          {/* Pathway 2: Prime Customer */}
          <div className="bg-neutral-950 text-white p-8 md:p-10 rounded-sm hover:bg-black transition-colors duration-300 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl pointer-events-none"></div>
            <div>
              <div className="flex justify-between items-start mb-6">
                <span className="text-[10px] tracking-[0.3em] font-bold text-neutral-500 uppercase">
                  Pathway 02
                </span>
                <span className="bg-white/10 text-white text-[10px] font-medium tracking-widest uppercase px-2.5 py-1 rounded-full">
                  Prime Membership
                </span>
              </div>
              <h3 className="text-lg md:text-xl font-light tracking-wider uppercase text-white mb-4">
                Full-to-Full Bespoke Customization
              </h3>
              <p className="text-neutral-400 text-sm font-light leading-relaxed mb-6">
                Engineered for patrons who demand absolute structural control matching their precise posture and silhouette parameters.
              </p>
              <ul className="space-y-3 text-neutral-400 text-xs font-light">
                <li className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-white rounded-full"></div>
                  Unlock complete end-to-end custom master tailoring dynamically.
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-white rounded-full"></div>
                  Full structural design freedom for custom necklines, waistcoats, and sleeve cuts.
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-white rounded-full"></div>
                  Bespoke execution for premium wedding collections, Jodhpuri coats, and elite suits.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Corporate Identity & Statutory Governance (Razorpay/DTDC Gateways Compliance) */}
      <div className="bg-neutral-50 p-6 md:p-10 border border-neutral-100 rounded-sm max-w-4xl mx-auto">
        <div className="flex items-center gap-3 border-b border-neutral-200 pb-4 mb-6">
          <ShieldCheck size={20} className="text-neutral-800" />
          <h3 className="text-sm tracking-[0.2em] font-semibold uppercase text-neutral-900">
            Corporate Governance Registry
          </h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-xs font-light text-neutral-600">
          <div className="flex justify-between md:justify-start gap-4 border-b border-neutral-200/50 pb-2 md:border-none">
            <span className="font-semibold text-neutral-900 w-32 uppercase tracking-wider">Legal Entity:</span>
            <span>LUXARDO FASHION WORLD PRIVATE LIMITED</span>
          </div>
          <div className="flex justify-between md:justify-start gap-4 border-b border-neutral-200/50 pb-2 md:border-none">
            <span className="font-semibold text-neutral-900 w-32 uppercase tracking-wider">CIN:</span>
            <span className="font-mono text-neutral-900">U47711RJ2026PTC113529</span>
          </div>
          <div className="flex justify-between md:justify-start gap-4 border-b border-neutral-200/50 pb-2 md:border-none">
            <span className="font-semibold text-neutral-900 w-32 uppercase tracking-wider">GSTIN:</span>
            <span className="font-mono text-neutral-900">08AAGCL8467K1ZT</span>
          </div>
          <div className="flex justify-between md:justify-start gap-4 border-b border-neutral-200/50 pb-2 md:border-none">
            <span className="font-semibold text-neutral-900 w-32 uppercase tracking-wider">Headquarters:</span>
            <span>Bhilwara, Rajasthan, India</span>
          </div>
          <div className="flex justify-between md:justify-start gap-4 border-b border-neutral-200/50 pb-2 md:border-none">
            <span className="font-semibold text-neutral-900 w-32 uppercase tracking-wider">Direct Desk:</span>
            <span className="underline">connect@luxardofashion.com</span>
          </div>
          <div className="flex justify-between md:justify-start gap-4 pb-2 md:border-none">
            <span className="font-semibold text-neutral-900 w-32 uppercase tracking-wider">Support Desk:</span>
            <span>+91 96640 40699</span>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-neutral-200 text-center text-[10px] text-neutral-400 font-light leading-relaxed">
          Registered Office Address: First Floor, Plot No. 6, Aaraji No. 3608, Engineers Colony, BSL Road, Bhilwara, Rajasthan, 311001. All commercial processing, disputes, and compliance management are anchored under the legislative jurisdiction of Rajasthan, India.
        </div>
      </div>

    </div>
  );
}