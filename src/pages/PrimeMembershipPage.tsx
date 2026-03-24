import React, { useState, useEffect } from 'react';
import { SectionHeader } from '../components/SectionHeader';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { formatINR } from '../utils/currency';
import { storage } from '../utils/localStorage';
import { AlertCircle } from 'lucide-react';

export default function PrimeMembershipPage() {
  const { user } = useAuth();
  const [content, setContent] = useState(storage.getPrimeContent());
  const [globalSettings, setGlobalSettings] = useState(storage.getPrimeGlobalSettings());

  useEffect(() => {
    setContent(storage.getPrimeContent());
    setGlobalSettings(storage.getPrimeGlobalSettings());
  }, []);

  return (
    <div className="min-h-screen bg-brand-bg">
      {/* Global Offline Message */}
      {!globalSettings.isLive && (
        <div className="bg-amber-50 border-b border-amber-200 py-4 px-6 text-center">
          <div className="flex items-center justify-center gap-2 text-amber-800">
            <AlertCircle size={16} />
            <p className="text-sm font-sans font-medium">{globalSettings.offlineMessage}</p>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="section-padding bg-brand-black text-brand-white text-center relative overflow-hidden">
        <div 
          className="absolute inset-0 opacity-20 bg-cover bg-center grayscale" 
          style={{ backgroundImage: `url('${content.hero.imageUrl}')` }}
        />
        <div className="absolute inset-0 bg-brand-black/80" />
        
        <div className="relative z-10 max-w-4xl mx-auto space-y-12 py-20">
          <h1 className="text-5xl md:text-7xl font-display tracking-wide">{content.hero.heading}</h1>
          <p className="text-xl md:text-2xl font-sans text-brand-white/80 max-w-2xl mx-auto leading-relaxed">
            {content.hero.subheading}
          </p>
          <div className="text-3xl font-display">
            {formatINR(content.hero.price)} <span className="text-lg font-sans text-brand-white/60">/ year</span>
          </div>
          <div className="pt-8">
            {!globalSettings.isLive ? (
              <div className="inline-block px-12 py-5 bg-brand-white/10 border border-brand-white/20 text-brand-white text-[11px] uppercase tracking-[0.25em] font-bold">
                {globalSettings.offlineMessage}
              </div>
            ) : user?.isPrimeMember ? (
              <div className="inline-block px-12 py-5 bg-brand-white text-brand-black text-[11px] uppercase tracking-[0.25em] font-bold">
                MEMBERSHIP ACTIVE
              </div>
            ) : content.settings?.salesEnabled ? (
              <Link to="/prime-membership/checkout" className="btn-primary bg-brand-white text-brand-black hover:bg-brand-divider inline-block px-12 py-5">
                {content.hero.ctaLabel}
              </Link>
            ) : (
              <div className="inline-block px-12 py-5 bg-brand-white/10 border border-brand-white/20 text-brand-white text-[11px] uppercase tracking-[0.25em] font-bold">
                Prime Member access is currently unavailable.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="section-padding max-w-[1400px] mx-auto">
        <SectionHeader title="Membership Benefits" subtitle="Exclusive Privileges" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
          {content.benefits.map((benefit, i) => (
            <motion.div 
              key={benefit.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-brand-white p-10 border border-brand-divider space-y-6"
            >
              <div className="w-12 h-12 rounded-full bg-brand-black flex items-center justify-center text-brand-white font-display text-xl">
                0{i + 1}
              </div>
              <h3 className="text-2xl font-display">{benefit.title}</h3>
              <p className="font-sans text-brand-secondary leading-relaxed">{benefit.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Member Services Section (Visible only to members) */}
      {user?.isPrimeMember && globalSettings.isLive && (
        <section className="section-padding bg-brand-white border-t border-brand-divider">
          <div className="max-w-[1400px] mx-auto">
            <SectionHeader title="Member Services" subtitle="Access Your Exclusive Privileges" />
            <div className="mb-12 max-w-2xl">
              <p className="font-sans text-brand-secondary leading-relaxed italic">
                {content.welcomeText}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { 
                  title: 'Style Consultation', 
                  desc: 'Book a private session with our master stylists.',
                  link: '/prime-membership/style-consultation',
                  action: 'Book Session',
                  enabled: content.settings?.consultationEnabled && user.primePrivileges?.consultation
                },
                { 
                  title: 'Bespoke Request', 
                  desc: 'Commission a one-of-a-kind tailored garment.',
                  link: '/prime-membership/bespoke-request',
                  action: 'Start Request',
                  enabled: content.settings?.bespokeEnabled && user.primePrivileges?.bespoke
                },
                { 
                  title: 'Fabric Library', 
                  desc: 'Explore our exclusive collection of premium fabrics.',
                  link: '/prime-membership/fabric-library',
                  action: 'View Library',
                  enabled: content.settings?.fabricLibraryEnabled && user.primePrivileges?.fabricLibrary
                }
              ].map((service) => (
                <div key={service.title} className={`p-10 border border-brand-divider space-y-6 transition-colors group ${service.enabled ? 'hover:border-brand-black' : 'opacity-50 grayscale cursor-not-allowed'}`}>
                  <h3 className="text-2xl font-display">{service.title}</h3>
                  <p className="font-sans text-brand-secondary leading-relaxed">{service.desc}</p>
                  <div className="pt-4">
                    {service.enabled ? (
                      <Link to={service.link} className="text-[11px] uppercase tracking-[0.25em] font-bold text-brand-black border-b border-brand-black pb-1 group-hover:pr-4 transition-all">
                        {service.action}
                      </Link>
                    ) : (
                      <span className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary">
                        Service Temporarily Unavailable
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Important Distinctions */}
      <section className="section-padding bg-brand-white border-y border-brand-divider">
        <div className="max-w-4xl mx-auto text-center space-y-12">
          <h2 className="text-4xl font-display">Important Distinctions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-left">
            <div className="space-y-4">
              <h4 className="text-[11px] uppercase tracking-[0.25em] font-bold text-brand-black">Garment Costs</h4>
              <p className="font-sans text-brand-secondary leading-relaxed">
                {content.supportingNote}
              </p>
            </div>
            <div className="space-y-4">
              <h4 className="text-[11px] uppercase tracking-[0.25em] font-bold text-brand-black">Bespoke Quotations</h4>
              <p className="font-sans text-brand-secondary leading-relaxed">
                Bespoke garments are unique commissions. Pricing is quoted separately following your style consultation, based on fabric selection and design complexity.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Membership Policies */}
      <section className="section-padding max-w-[1400px] mx-auto">
        <SectionHeader title="Membership Policies" subtitle="Terms of Service" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            { title: 'Annual Validity', desc: 'Membership is valid for 12 months from the date of activation.' },
            { title: 'Non-Refundable', desc: 'The membership fee is strictly non-refundable once activated.' },
            { title: 'Registered Member Only', desc: 'Privileges are valid only for the registered account holder.' },
            { title: 'Non-Transferable', desc: 'Membership status cannot be transferred to another individual.' },
            { title: 'Service Availability', desc: 'Consultations and bespoke slots are subject to availability.' },
            { title: 'Separate Charges', desc: 'Bespoke garment and shipping charges are handled separately.' },
            { title: 'Scheduling Required', desc: 'Private consultations require advance scheduling via the concierge.' }
          ].map((policy, i) => (
            <div key={i} className="p-8 border border-brand-divider space-y-4">
              <h4 className="text-[11px] uppercase tracking-[0.25em] font-bold text-brand-black">{policy.title}</h4>
              <p className="text-sm font-sans text-brand-secondary leading-relaxed">{policy.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 text-center bg-brand-black text-brand-white">
        <div className="max-w-2xl mx-auto space-y-12 px-6">
          <h2 className="text-4xl font-display">Begin Your Journey</h2>
          <p className="font-sans text-brand-white/60 leading-relaxed">
            Step into the inner circle of LUXARDO. Experience the pinnacle of modern ethnic luxury through our Prime Member Services.
          </p>
          <div className="pt-8">
            {!globalSettings.isLive ? (
              <div className="inline-block px-16 py-5 bg-brand-white/10 border border-brand-white/20 text-brand-white text-[11px] uppercase tracking-[0.25em] font-bold">
                {globalSettings.offlineMessage}
              </div>
            ) : user?.isPrimeMember ? (
              <div className="inline-block px-16 py-5 bg-brand-white text-brand-black text-[11px] uppercase tracking-[0.25em] font-bold">
                MEMBERSHIP ACTIVE
              </div>
            ) : content.settings?.salesEnabled ? (
              <Link to="/prime-membership/checkout" className="btn-primary bg-brand-white text-brand-black hover:bg-brand-divider inline-block px-16">
                {content.hero.ctaLabel}
              </Link>
            ) : (
              <div className="inline-block px-16 py-5 bg-brand-white/10 border border-brand-white/20 text-brand-white text-[11px] uppercase tracking-[0.25em] font-bold">
                Prime Member access is currently unavailable.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
