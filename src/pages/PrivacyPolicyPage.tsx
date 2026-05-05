import React from 'react';
import { Shield, Lock, EyeOff, Server, Mail, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const policyLinks = [
  { label: "Privacy Policy", path: "/privacy-policy", active: true },
  { label: "Terms of Service", path: "/terms-of-service", active: false },
  { label: "Return & Refund", path: "/return-policy", active: false },
  { label: "Shipping Policy", path: "/shipping-policy", active: false },
  { label: "Cookie Policy", path: "/cookie-policy", active: false },
];

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-neutral-900 font-sans selection:bg-neutral-900 selection:text-white">
      {/* Hero Section */}
      <div className="relative pt-32 pb-20 px-6 md:px-12 lg:px-24 bg-neutral-900 text-white flex flex-col items-center text-center">
        <p className="text-xs tracking-[0.3em] text-neutral-400 font-medium uppercase mb-6">Laxardo — Legal</p>
        <h1 className="text-4xl md:text-5xl lg:text-7xl font-serif font-light tracking-tight mb-6">Privacy Policy</h1>
        <p className="text-sm text-neutral-400 font-sans mb-8">Effective Date: May 2, 2026</p>
      </div>

      {/* Navigation */}
      <div className="border-b border-neutral-200 bg-white sticky top-0 z-40 overflow-x-auto no-scrollbar">
        <div className="max-w-5xl mx-auto px-6 md:px-12 flex space-x-8">
          {policyLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`py-4 text-xs font-semibold tracking-widest uppercase whitespace-nowrap border-b-2 transition-colors ${
                link.active 
                  ? 'border-neutral-900 text-neutral-900' 
                  : 'border-transparent text-neutral-400 hover:text-neutral-900'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 md:px-12 py-20 lg:py-32">
        <div className="space-y-24">
          
          <section>
            <div className="mb-8 flex items-center space-x-4">
              <Shield className="w-6 h-6 text-neutral-400" strokeWidth={1.5} />
              <h2 className="text-2xl md:text-3xl font-serif">Commitment to B2B Partners</h2>
            </div>
            <div className="prose prose-neutral prose-lg max-w-none text-neutral-600 leading-relaxed font-light">
              <p>
                At <strong>Laxardo</strong>, maintaining the trust of our B2B partners, distributors, and exclusive clientele is our highest priority. We understand the sensitive nature of the fashion retail industry, particularly regarding unreleased designs and proprietary distribution networks. This Privacy Policy outlines our uncompromising approach to safeguarding your business and personal data.
              </p>
            </div>
          </section>

          <section>
            <div className="mb-8 flex items-center space-x-4">
              <EyeOff className="w-6 h-6 text-neutral-400" strokeWidth={1.5} />
              <h2 className="text-2xl md:text-3xl font-serif">Laxardo Secure App Protocols</h2>
            </div>
            <div className="prose prose-neutral prose-lg max-w-none text-neutral-600 leading-relaxed font-light">
              <p>
                To protect our upcoming catalogue designs from piracy and unauthorized replication, access to unreleased collections is strictly governed through the <strong>Laxardo Secure App</strong> environment. We employ stringent digital rights management protocols:
              </p>
              <ul className="mt-6 space-y-4 list-none pl-0">
                <li className="flex items-start">
                  <span className="w-1.5 h-1.5 bg-neutral-900 rounded-full mt-2.5 mr-4 flex-shrink-0"></span>
                  <span><strong>Screenshot Blocking:</strong> Active prevention of screen capturing across mobile and desktop interfaces to protect intellectual property.</span>
                </li>
                <li className="flex items-start">
                  <span className="w-1.5 h-1.5 bg-neutral-900 rounded-full mt-2.5 mr-4 flex-shrink-0"></span>
                  <span><strong>Screen-Recording Prevention:</strong> OS-level hooks restrict active screen recording sessions while viewing seasonal collections.</span>
                </li>
                <li className="flex items-start">
                  <span className="w-1.5 h-1.5 bg-neutral-900 rounded-full mt-2.5 mr-4 flex-shrink-0"></span>
                  <span><strong>IP Tracking & Forensics:</strong> Authorized viewings are logged and watermarked to trace any unauthorized distribution back to its source.</span>
                </li>
              </ul>
            </div>
          </section>

          <section>
            <div className="mb-8 flex items-center space-x-4">
              <Lock className="w-6 h-6 text-neutral-400" strokeWidth={1.5} />
              <h2 className="text-2xl md:text-3xl font-serif">Financial & Transaction Data</h2>
            </div>
            <div className="prose prose-neutral prose-lg max-w-none text-neutral-600 leading-relaxed font-light">
              <p>
                As a B2B operator handling high-value orders and wholesale accounts, financial security is vital. We utilize <strong>256-bit encryption</strong> for all transaction and ledger data flowing through our internal payment infrastructure. Payment gateways are PCI-DSS compliant, and Laxardo does not store raw credit card details on our local servers.
              </p>
            </div>
          </section>

          <section>
            <div className="mb-8 flex items-center space-x-4">
              <Server className="w-6 h-6 text-neutral-400" strokeWidth={1.5} />
              <h2 className="text-2xl md:text-3xl font-serif">Data Sovereignty & Non-Disclosure</h2>
            </div>
            <div className="prose prose-neutral prose-lg max-w-none text-neutral-600 leading-relaxed font-light">
              <p>
                We operate on a philosophy of absolute confidentiality regarding our distribution network. <strong>Laxardo never sells, rents, or leases our B2B network data to third-party marketers or data brokers.</strong> Your distributor profile, purchase volumes, and retail locations are treated as confidential trade secrets. Information is only shared with logistics partners explicitly required to fulfill your consignments.
              </p>
            </div>
          </section>

          <hr className="border-t border-neutral-200" />

          <section>
            <div className="mb-8 flex items-center space-x-4">
              <Mail className="w-6 h-6 text-neutral-400" strokeWidth={1.5} />
              <h2 className="text-2xl md:text-3xl font-serif">Contact Our DPO</h2>
            </div>
            <div className="prose prose-neutral prose-lg max-w-none text-neutral-600 leading-relaxed font-light">
              <p className="mb-8">
                For inquiries regarding data portability, erasure requests, or audit compliance, please contact our Data Protection Officer immediately.
              </p>
              
              <div className="p-8 border border-neutral-200 bg-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between group">
                <div>
                  <p className="text-sm font-semibold tracking-widest uppercase text-neutral-900 mb-1">Data Protection Officer</p>
                  <a href="mailto:legal@laxardo.com" className="text-xl md:text-2xl font-serif text-neutral-500 group-hover:text-neutral-900 transition-colors">
                    legal@laxardo.com
                  </a>
                </div>
                <div className="mt-6 sm:mt-0">
                  <a href="mailto:legal@laxardo.com" className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-neutral-200 hover:bg-neutral-900 hover:text-white transition-all text-neutral-400">
                    <ChevronRight className="w-5 h-5" strokeWidth={1} />
                  </a>
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}