import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { SectionHeader } from '../components/SectionHeader';
import { ArrowRight, Scissors, Ruler, PenTool, ShieldCheck, Package, Layers, Search } from 'lucide-react';
import { storage } from '../utils/localStorage';

export default function CraftsmanshipPage() {
  const siteContent = storage.getSiteContent();
  const [content, setContent] = useState(siteContent.craftsmanship);

  useEffect(() => {
    const updatedSiteContent = storage.getSiteContent();
    setContent(updatedSiteContent.craftsmanship);
  }, []);

  const getIcon = (id: string) => {
    switch (id) {
      case '01': return <Layers size={24} />;
      case '02': return <PenTool size={24} />;
      case '03': return <Search size={24} />;
      case '04': return <Ruler size={24} />;
      case '05': return <Scissors size={24} />;
      case '06': return <ShieldCheck size={24} />;
      case '07': return <CheckCircleIcon size={24} />;
      case '08': return <Package size={24} />;
      default: return <Layers size={24} />;
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-black">
      {/* Hero Section */}
      <section className="relative h-[80vh] flex items-center justify-center overflow-hidden bg-brand-black">
        <div className="absolute inset-0 opacity-40">
          <img 
            src={content.hero.imageUrl} 
            alt="Craftsmanship" 
            className="w-full h-full object-cover grayscale"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-brand-black/60" />
        <div className="relative z-10 text-center space-y-8 px-6">
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[11px] uppercase tracking-[0.4em] font-bold text-brand-white/80"
          >
            {content.hero.subtitle}
          </motion.p>
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-6xl md:text-8xl font-display text-brand-white tracking-tight"
          >
            {content.hero.title}
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-xl md:text-2xl font-sans text-brand-white/60 max-w-2xl mx-auto leading-relaxed"
          >
            {content.hero.description}
          </motion.p>
        </div>
      </section>

      {/* Intro Section */}
      <section className="section-padding max-w-5xl mx-auto text-center space-y-12">
        <h2 className="text-3xl md:text-5xl font-display leading-tight">
          {content.intro.heading}
        </h2>
        <div className="w-24 h-px bg-brand-divider mx-auto" />
        <p className="text-xl font-sans text-brand-secondary leading-relaxed max-w-3xl mx-auto">
          {content.intro.text}
        </p>
      </section>

      {/* Process Grid */}
      <section className="section-padding bg-brand-white border-y border-brand-divider">
        <div className="max-w-[1400px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-brand-divider border border-brand-divider">
            {content.process.map((step: any, i: number) => (
              <motion.div 
                key={step.id}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-brand-white p-12 space-y-8 hover:bg-brand-bg transition-colors duration-500 group"
              >
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold tracking-widest text-brand-secondary">{step.id}</span>
                  <div className="text-brand-black opacity-20 group-hover:opacity-100 transition-opacity">
                    {getIcon(step.id)}
                  </div>
                </div>
                <div className="space-y-4">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary">{step.subtitle}</p>
                  <h3 className="text-2xl font-display">{step.title}</h3>
                  <p className="text-sm font-sans text-brand-secondary leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Detailed Sections */}
      <section className="section-padding max-w-[1400px] mx-auto space-y-32">
        {content.detailedSections.map((section: any, idx: number) => (
          <div key={idx} className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
            <div className={`space-y-12 ${idx % 2 !== 0 ? 'lg:order-last' : ''}`}>
              <div className="space-y-4">
                <p className="text-[11px] uppercase tracking-widest font-bold text-brand-secondary">{section.label}</p>
                <h2 className="text-4xl md:text-6xl font-display tracking-tight">{section.title}</h2>
              </div>
              <p className="text-lg font-sans text-brand-secondary leading-relaxed">
                {section.text}
              </p>
              <div className={`grid ${section.points.length > 2 ? 'grid-cols-1' : 'grid-cols-2'} gap-8 pt-8 border-t border-brand-divider`}>
                {section.points.map((point: any, pIdx: number) => (
                  <div key={pIdx} className="space-y-2">
                    {section.points.length > 2 ? (
                      <div className="flex items-center gap-6">
                        <div className="w-12 h-px bg-brand-black" />
                        <span className="text-[11px] uppercase tracking-widest font-bold">{point.title}</span>
                      </div>
                    ) : (
                      <>
                        <h4 className="text-[11px] uppercase tracking-widest font-bold">{point.title}</h4>
                        <p className="text-xs font-sans text-brand-secondary">{point.desc}</p>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className={`aspect-[4/5] bg-brand-white border border-brand-divider overflow-hidden ${idx % 2 !== 0 ? '' : ''}`}>
              <img 
                src={section.imageUrl} 
                alt={section.title} 
                className="w-full h-full object-cover grayscale hover:scale-105 transition-transform duration-1000"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        ))}
      </section>

      {/* Trust Quote */}
      <section className="section-padding bg-brand-black text-brand-white text-center">
        <div className="max-w-4xl mx-auto space-y-12">
          <ShieldCheck size={48} className="mx-auto opacity-40" />
          <h2 className="text-3xl md:text-5xl font-display leading-tight italic">
            "{content.quote}"
          </h2>
          <p className="text-[11px] uppercase tracking-[0.4em] font-bold text-brand-white/40">
            Luxardo Quality Assurance
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="section-padding text-center space-y-12">
        <div className="space-y-4">
          <h2 className="text-3xl font-display">Experience the Discipline</h2>
          <p className="font-sans text-brand-secondary">Explore our latest collections or request a private membership.</p>
        </div>
        <div className="flex flex-col sm:flex-row justify-center gap-6">
          <Link to="/collections" className="btn-primary px-12 py-5 flex items-center justify-center gap-4">
            VIEW COLLECTIONS <ArrowRight size={18} />
          </Link>
          <Link to="/prime-membership" className="btn-secondary border border-brand-black px-12 py-5 text-[11px] uppercase tracking-widest font-bold hover:bg-brand-black hover:text-brand-white transition-all">
            PRIVATE MEMBERSHIP
          </Link>
        </div>
      </section>
    </div>
  );
}

function CheckCircleIcon({ size }: { size: number }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="1.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
