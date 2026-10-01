import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { storage } from '../utils/localStorage';

export default function CraftsmanshipPage() {
  const { scrollY } = useScroll();
  const [content, setContent] = useState(storage.getSiteContent().craftsmanship);

  useEffect(() => {
    setContent(storage.getSiteContent().craftsmanship);
  }, []);

  // Desktop Parallax for Visual Depth Section
  const depthY1 = useTransform(scrollY, [0, 1500], [0, 150]);
  const depthY2 = useTransform(scrollY, [0, 1500], [0, 50]);

  // 3D Hover Effect for Desktop
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -5;
    const rotateY = ((x - centerX) / centerX) * 5;

    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-brand-black selection:bg-brand-black selection:text-brand-white">
      
      {/* 1. HERO SECTION (FEEL-FELT-FOUND) */}
      <section className="relative min-h-screen w-full flex flex-col md:flex-row items-center bg-brand-white border-b border-brand-black/10 pt-24 md:pt-0">
        
        {/* Left: Text Content */}
        <div className="w-full md:w-1/2 px-6 md:px-16 lg:px-24 flex flex-col justify-center z-10 py-12 md:py-0">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="max-w-xl"
          >
            <div className="flex items-center gap-4 mb-8">
              <span className="w-8 h-[1px] bg-brand-black"></span>
              <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-brand-black">The LUXARDO FASHION Standard</span>
            </div>
            
            <div className="space-y-8 md:space-y-12">
              <p className="text-xl md:text-3xl font-display leading-tight text-brand-black">
                {content.hero?.feel}
              </p>
              <p className="text-lg md:text-2xl font-display leading-tight text-brand-secondary/60 italic font-light">
                {content.hero?.felt}
              </p>
              <p className="text-lg md:text-2xl font-display leading-tight text-brand-black font-medium">
                {content.hero?.found}
              </p>
            </div>

            <div className="mt-12 flex flex-col sm:flex-row gap-4">
              <Link 
                to="/collections" 
                className="px-8 py-4 bg-brand-black text-brand-white text-[10px] uppercase tracking-[0.3em] font-bold text-center hover:bg-brand-black/90 transition-colors"
              >
                {content.cta?.primary || "Explore Collection"}
              </Link>
              <Link 
                to="/prime-membership" 
                className="px-8 py-4 border border-brand-black/20 text-brand-black text-[10px] uppercase tracking-[0.3em] font-bold text-center hover:border-brand-black transition-colors"
              >
                {content.cta?.secondary || "Join Prime"}
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Right: Premium Visual (image-optional) */}
        <div className="w-full md:w-1/2 h-[50vh] md:h-screen relative overflow-hidden bg-gradient-to-br from-[#f3eee3] via-[#e8e0cd] to-[#d6cab0]">
          {content.hero?.image && content.hero.image !== '/placeholder.svg' && !content.hero.image.endsWith('placeholder.svg') ? (
            <motion.img
              initial={{ scale: 1.05, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              src={content.hero.image}
              alt="Craftsmanship"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            // Editorial typography fallback
            <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 opacity-[0.06]" style={{
                backgroundImage: 'linear-gradient(rgba(0,0,0,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.5) 1px, transparent 1px)',
                backgroundSize: '50px 50px'
              }} />
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.4 }}
                className="text-center px-8 relative z-10"
              >
                <div className="text-[10px] uppercase tracking-[0.5em] text-brand-black/40 mb-6">Maison</div>
                <div className="text-5xl md:text-7xl font-display tracking-[0.2em] text-brand-black/80">LUXARDO</div>
                <div className="text-[11px] tracking-[0.4em] text-brand-black/40 mt-3">FASHION · ITALY</div>
                <div className="mt-12 w-12 h-[1px] bg-brand-black/30 mx-auto"></div>
                <div className="text-xs tracking-[0.3em] uppercase text-brand-black/40 mt-6 font-light">Crafted in Bhilwara</div>
              </motion.div>
            </div>
          )}
        </div>
      </section>

      {/* 2 + 3. PROCESS TIMELINE — Vertical story: Fabric → Handwork → QC → Packing */}
      <section className="py-20 md:py-32 bg-brand-white px-6 md:px-16 lg:px-24 relative">
        <div className="max-w-5xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-16 md:mb-24">
            <div className="inline-flex items-center gap-4 mb-6 justify-center">
              <span className="w-8 h-[1px] bg-brand-black"></span>
              <span className="text-[10px] uppercase tracking-[0.4em] font-bold text-brand-secondary">The Process</span>
              <span className="w-8 h-[1px] bg-brand-black"></span>
            </div>
            <h2 className="text-3xl md:text-5xl lg:text-6xl font-display tracking-tight text-brand-black leading-[1.1] mb-6">
              From Fabric to Finish
            </h2>
            <p className="text-sm md:text-base text-brand-secondary/80 font-light max-w-xl mx-auto leading-relaxed">
              Four disciplined stages. Each one supervised, signed off, and refined before the next begins.
            </p>
          </div>

          {/* Vertical timeline */}
          <div className="relative">
            {/* Center vertical line (desktop) */}
            <div className="hidden md:block absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-[1px] bg-brand-black/15"></div>
            {/* Left-edge line (mobile) */}
            <div className="md:hidden absolute left-6 top-0 bottom-0 w-[1px] bg-brand-black/15"></div>

            {(content.process && content.process.length >= 4 ? content.process : [
              { title: 'Fabric Sourcing', description: 'Premium fabrics imported from the world\'s finest mills — selected for texture, drape, weight, and structural integrity.' },
              { title: 'Master Handwork', description: 'Master artisans hand-finish every stitch, embroidery, and detail. Heritage techniques refined over generations.' },
              { title: 'Quality Check', description: 'Multi-stage QC: fabric inspection, stitch tension, hand-finish review, and final structural fit verification.' },
              { title: 'Premium Packing', description: 'Each piece is folded with archival tissue, sealed in our Maison Box, and dispatched via DTDC Premium courier.' },
            ]).slice(0, 4).map((step: any, idx: number) => {
              const isLeft = idx % 2 === 0;
              const labels = ['Fabric', 'Handwork', 'Quality Check', 'Packing'];
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                  className="relative mb-16 md:mb-24 last:mb-0"
                >
                  {/* Numbered node (desktop center, mobile left-edge) */}
                  <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 top-6 z-10 w-12 h-12 rounded-full bg-brand-black text-white items-center justify-center font-display text-lg shadow-lg">
                    {String(idx + 1).padStart(2, '0')}
                  </div>
                  <div className="md:hidden absolute left-6 -translate-x-1/2 top-2 z-10 w-10 h-10 rounded-full bg-brand-black text-white flex items-center justify-center font-display text-sm shadow-lg">
                    {String(idx + 1).padStart(2, '0')}
                  </div>

                  {/* Content card — alternating left/right on desktop, full-width on mobile */}
                  <div className={`md:w-1/2 md:px-12 pl-14 md:pl-12 ${isLeft ? 'md:pr-12 md:text-right md:ml-0' : 'md:ml-[50%]'}`}>
                    <div className="bg-[#FAFAFA] border border-brand-black/8 p-6 md:p-8 relative">
                      {/* Decorative tag */}
                      <div className={`flex items-center gap-3 mb-4 ${isLeft ? 'md:justify-end' : 'md:justify-start'}`}>
                        <span className="text-[9px] tracking-[0.4em] uppercase text-brand-secondary font-bold">
                          Stage {idx + 1}
                        </span>
                        <span className="w-6 h-[1px] bg-brand-secondary/40"></span>
                        <span className="text-[9px] tracking-[0.3em] uppercase text-brand-secondary">{labels[idx] || step.title}</span>
                      </div>
                      <h3 className="text-2xl md:text-3xl font-display tracking-tight text-brand-black mb-4 leading-tight">
                        {step.title}
                      </h3>
                      <p className="text-sm md:text-base text-brand-secondary/80 font-light leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Bottom divider with brand mark */}
          <div className="mt-20 md:mt-32 flex flex-col items-center">
            <div className="w-[1px] h-12 bg-brand-black/20 mb-6"></div>
            <p className="text-[10px] tracking-[0.4em] uppercase text-brand-secondary text-center">
              Every piece. Every time. Every stitch supervised.
            </p>
          </div>
        </div>
      </section>

      {/* 4. DIFFERENTIATION SECTION */}
      <section className="py-24 md:py-48 bg-[#F5F5F5] px-6 text-center border-y border-brand-black/5">
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl mx-auto"
        >
          <h2 className="text-3xl md:text-6xl lg:text-7xl font-display tracking-tight leading-[1.1] text-brand-black mb-6 md:mb-10">
            {content.differentiation?.title}
          </h2>
          <p className="text-sm md:text-xl font-sans text-brand-secondary/80 font-light leading-relaxed max-w-2xl mx-auto">
            {content.differentiation?.description}
          </p>
        </motion.div>
      </section>

      {/* 5. PRIME / LIMITED EDITION SECTION */}
      <section className="py-24 md:py-40 bg-brand-black text-brand-white px-6 md:px-16 lg:px-24">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="w-full md:w-1/2">
            <div className="flex items-center gap-4 mb-6">
              <span className="w-8 h-[1px] bg-brand-white/50"></span>
              <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-brand-white/80">Exclusive Access</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-display tracking-tight mb-8">
              {content.prime?.title}
            </h2>
            <p className="text-sm md:text-lg font-sans text-brand-white/70 font-light leading-relaxed max-w-md">
              {content.prime?.description}
            </p>
          </div>
          <div className="w-full md:w-1/2 flex justify-center md:justify-end">
            <Link 
              to="/prime-membership" 
              className="group flex items-center justify-center w-40 h-40 md:w-56 md:h-56 rounded-full border border-brand-white/20 hover:border-brand-white transition-colors duration-500"
            >
              <span className="text-[10px] md:text-xs uppercase tracking-[0.3em] font-bold text-center px-4 group-hover:scale-105 transition-transform">
                Unlock<br/>Prime
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* 6. IDENTITY STATEMENT & 7. FINAL CTA */}
      <section className="py-32 md:py-48 bg-brand-white text-center px-6">
        <div className="max-w-4xl mx-auto space-y-16">
          <h2 className="text-2xl md:text-5xl lg:text-6xl font-display tracking-tight text-brand-black leading-tight">
            "{content.identity}"
          </h2>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link 
              to="/collections" 
              className="group relative px-8 py-4 bg-brand-black text-brand-white overflow-hidden flex items-center justify-center"
            >
              <div className="absolute inset-0 bg-brand-secondary translate-y-[100%] group-hover:translate-y-0 transition-transform duration-500 ease-in-out" />
              <span className="relative flex items-center gap-4 text-[10px] uppercase tracking-[0.3em] font-bold">
                {content.cta?.primary} <ArrowRight size={14} className="transform group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
            <Link 
              to="/prime-membership" 
              className="px-8 py-4 border border-brand-black/20 hover:border-brand-black transition-colors duration-500 flex items-center justify-center"
            >
              <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-brand-black">
                {content.cta?.secondary}
              </span>
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}

