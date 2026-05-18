import React from "react";
import { Link } from "react-router-dom";
import { Instagram, Facebook, Twitter } from "lucide-react";
import { BUSINESS_CONFIG } from "../constants/businessConfig";
import Logo from "./Logo";

export default function ComplianceFooter() {
  const config = BUSINESS_CONFIG;
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#0a0a0a] text-white pt-16 pb-8 px-6 md:px-12 border-t border-neutral-900 font-sans mt-auto select-none">
      <div className="max-w-[1600px] mx-auto">
        
        {/* Main Grid Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 pb-12 border-b border-neutral-900">
          
          {/* Left Block: Brand Identity Logo (Forced White) */}
          <div className="lg:col-span-5 space-y-5">
            {/* Wrapped Logo in div with filters to make it solid white against dark bg */}
            <div className="inline-block text-white brightness-0 invert">
              <Logo />
            </div>
            <p className="text-neutral-400 text-xs md:text-sm font-light leading-relaxed max-w-md">
              Maison of contemporary unstitched luxury and handcrafted designs. Our corporate compliance management, centralized production house, and secure dispatch logistics are operated entirely out of <strong>Bhilwara, Rajasthan</strong> — the textile heart capital of India.
            </p>
          </div>

          {/* Middle Left Block: Quick Links */}
          <div className="grid grid-cols-2 gap-8 lg:col-span-4">
            <div>
              <h4 className="text-[11px] uppercase tracking-[0.25em] font-semibold text-neutral-400 mb-4">Maison</h4>
              <ul className="space-y-2.5 text-xs font-light text-neutral-400">
                <li><Link to="/about" className="hover:text-white transition-colors">About Us</Link></li>
                <li><Link to="/craftsmanship" className="hover:text-white transition-colors">Craftsmanship</Link></li>
                <li><Link to="/prime-membership" className="hover:text-white transition-colors">Prime Member</Link></li>
                <li><Link to="/contact" className="hover:text-white transition-colors">Contact Us</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[11px] uppercase tracking-[0.25em] font-semibold text-neutral-400 mb-4">Legal</h4>
              <ul className="space-y-2.5 text-xs font-light text-neutral-400">
                <li><Link to="/policies/shipping" className="hover:text-white transition-colors">Shipping Policy</Link></li>
                <li><Link to="/policies/returns" className="hover:text-white transition-colors">Returns Policy</Link></li>
                <li><Link to="/policies/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link to="/policies/terms" className="hover:text-white transition-colors">Terms & Conditions</Link></li>
              </ul>
            </div>
          </div>

          {/* Right Block: Social Links */}
          <div className="lg:col-span-3 space-y-4 lg:text-right">
            <h4 className="text-[11px] uppercase tracking-[0.25em] font-semibold text-neutral-400">Find Us On</h4>
            <div className="flex gap-4 lg:justify-end text-neutral-400">
              <a href="#" className="hover:text-white transition-colors" aria-label="Instagram"><Instagram size={18} /></a>
              <a href="#" className="hover:text-white transition-colors" aria-label="Facebook"><Facebook size={18} /></a>
              <a href="#" className="hover:text-white transition-colors" aria-label="Twitter"><Twitter size={18} /></a>
            </div>
          </div>

        </div>

        {/* Bottom Block: Statutory Corporate Grid & Copyright */}
        <div className="pt-8 text-center lg:text-left grid grid-cols-1 lg:grid-cols-2 gap-4 items-center text-[11px] text-neutral-500 font-light leading-relaxed">
          <div>
            <p>© {year} <strong className="text-neutral-400">{config.legalEntityName}</strong>. All rights reserved.</p>
            <p className="mt-1 font-mono text-[10px]">CIN: {config.cinNumber} | GSTIN: {config.gstin}</p>
          </div>
          <div className="lg:text-right text-[10px] text-neutral-500 space-y-1">
            <p>Registered Office: {config.businessAddress.line1}, {config.businessAddress.line2}, {config.businessAddress.city}, {config.businessAddress.state} - {config.businessAddress.pinCode}</p>
            <p>Support Matrix: {config.phone} | {config.email} (Hours: Mon-Sat, 10 AM - 7 PM IST)</p>
          </div>
        </div>

      </div>
    </footer>
  );
}
