import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useOutletContext, Link } from 'react-router-dom';
import { Country, Language } from '../types';
import { SectionHeader } from '../components/SectionHeader';
import { LuxardoProcess } from '../components/LuxardoProcess';
import { Logo } from '../components/Logo';
import { storage } from '../utils/localStorage';

export default function HomePage() {
  const { selectedCountry } = useOutletContext<{ selectedCountry: Country | null; selectedLanguage: Language }>();
  const siteContent = storage.getSiteContent();
  const [content, setContent] = useState(siteContent.homepage);

  useEffect(() => {
    const updatedSiteContent = storage.getSiteContent();
    setContent(updatedSiteContent.homepage);
  }, []);

  return (
    <>
      {/* Hero Section */}
      <section className="relative h-screen overflow-hidden bg-brand-black">
        <motion.div 
          initial={{ scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.7 }}
          transition={{ duration: 2, ease: "easeOut" }}
          className="absolute inset-0"
        >
          <img 
            src={content.hero.imageUrl} 
            alt="Luxardo Editorial" 
            className="w-full h-full object-cover grayscale"
            referrerPolicy="no-referrer"
          />
        </motion.div>
        
        <div className="absolute inset-0 bg-gradient-to-b from-brand-black/40 via-transparent to-brand-black/60" />
        
        <div className="absolute inset-0 flex flex-col items-center justify-center text-brand-white text-center px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center"
          >
            {/* Top Label */}
            <motion.p 
              initial={{ opacity: 0, letterSpacing: "0.2em" }}
              animate={{ opacity: 0.6, letterSpacing: "0.5em" }}
              transition={{ duration: 1.5, delay: 0.8 }}
              className="text-[11px] md:text-[13px] uppercase font-bold mb-8"
            >
              {content.hero.title}
            </motion.p>

            {/* Main Logo Branding */}
            <div className="relative mb-12">
              <Logo 
                className="h-[110px] md:h-[150px] w-auto drop-shadow-[0_0_30px_rgba(255,255,255,0.15)]" 
                dark 
              />
            </div>
            
            {/* Refined Subtitle Content */}
            <div className="max-w-2xl mx-auto space-y-8">
              <p className="text-2xl md:text-3xl font-display italic opacity-90 leading-relaxed tracking-wide">
                {content.hero.subtitle}
              </p>
              
              <div className="flex items-center justify-center gap-4 md:gap-8 opacity-40">
                <div className="h-[1px] w-8 md:w-12 bg-brand-white" />
                <p className="text-[11px] md:text-[12px] uppercase tracking-[0.4em] font-bold whitespace-nowrap">
                  Design Discipline
                </p>
                <div className="h-[1px] w-8 md:w-12 bg-brand-white" />
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-6 md:gap-10 justify-center pt-12">
              <Link to={content.hero.primaryCtaLink} className="group relative px-14 py-5 overflow-hidden">
                <div className="absolute inset-0 bg-brand-white transition-transform duration-500 group-hover:scale-105" />
                <span className="relative text-brand-black text-[10px] uppercase tracking-[0.3em] font-bold">
                  {content.hero.primaryCtaText}
                </span>
              </Link>
              <Link to={content.hero.secondaryCtaLink} className="group relative px-14 py-5 overflow-hidden border border-brand-white/20 hover:border-brand-white/60 transition-colors duration-500">
                <span className="relative text-brand-white text-[10px] uppercase tracking-[0.3em] font-bold">
                  {content.hero.secondaryCtaText}
                </span>
              </Link>
            </div>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2"
        >
          <div className="w-[1px] h-12 bg-gradient-to-b from-brand-white/50 to-transparent" />
        </motion.div>
      </section>

      {/* Brand Intro Section */}
      <section className="py-24 md:py-32 bg-brand-bg border-b border-brand-divider">
        <div className="max-w-[1800px] mx-auto px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 md:gap-24 items-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
              className="aspect-[4/3] bg-brand-divider overflow-hidden relative"
            >
              <img 
                src={content.intro.imageUrl} 
                alt="Luxardo Craftsmanship" 
                className="w-full h-full object-cover grayscale"
                referrerPolicy="no-referrer"
              />
            </motion.div>
            
            <div className="space-y-12 max-w-xl">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="space-y-4"
              >
                <p className="text-[10px] uppercase tracking-[0.4em] font-bold text-brand-secondary">{content.intro.label}</p>
                <h2 className="text-4xl md:text-5xl font-display tracking-wide">{content.intro.heading}</h2>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="space-y-8 text-lg font-sans text-brand-secondary leading-relaxed"
              >
                {content.intro.description.split('\n\n').map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
              >
                <Link to={content.intro.ctaLink} className="group inline-flex items-center gap-4 text-[11px] uppercase tracking-[0.3em] font-bold text-brand-black">
                  {content.intro.ctaText}
                  <div className="w-8 h-[1px] bg-brand-black transition-all duration-500 group-hover:w-16" />
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Quote Strip */}
      <section className="py-24 md:py-32 bg-brand-black text-brand-white text-center px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto space-y-8"
        >
          <div className="w-12 h-[1px] bg-brand-white/30 mx-auto" />
          <h3 className="text-3xl md:text-5xl font-display italic leading-relaxed tracking-wide">
            "Luxury is not just what you wear; it is the discipline behind how it was made."
          </h3>
          <p className="text-[10px] uppercase tracking-[0.4em] font-bold text-brand-white/50">Our Philosophy</p>
        </motion.div>
      </section>

      {/* Our Story Section */}
      <section className="py-24 md:py-32 bg-brand-white overflow-hidden">
        <div className="max-w-[1800px] mx-auto px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 md:gap-24 items-center">
            <div className="order-2 lg:order-1 relative">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1 }}
                className="aspect-[4/5] bg-brand-divider overflow-hidden relative z-10"
              >
                <img 
                  src={content.ourStory.imageUrl1} 
                  alt="Luxardo Heritage" 
                  className="w-full h-full object-cover grayscale"
                  referrerPolicy="no-referrer"
                />
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5, duration: 1 }}
                className="absolute -bottom-12 -left-12 w-2/3 aspect-square bg-brand-bg border border-brand-divider p-8 shadow-2xl z-20 hidden md:block"
              >
                <img 
                  src={content.ourStory.imageUrl2} 
                  alt="Design Sketch" 
                  className="w-full h-full object-contain opacity-40 grayscale"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-[10px] uppercase tracking-[0.5em] font-bold text-brand-secondary -rotate-90 origin-center whitespace-nowrap">Atelier Blueprint</p>
                </div>
              </motion.div>
            </div>

            <div className="order-1 lg:order-2 space-y-12">
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="space-y-6"
              >
                <p className="text-[10px] uppercase tracking-[0.4em] font-bold text-brand-secondary">{content.ourStory.label}</p>
                <h2 className="text-5xl md:text-7xl font-display tracking-tight leading-[1.1]">
                  {content.ourStory.heading.split(' ').map((word, i) => 
                    word.toLowerCase() === 'discipline' ? <span key={i} className="italic"> {word}</span> : ` ${word}`
                  )}
                </h2>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="space-y-8 text-lg font-sans text-brand-secondary leading-relaxed max-w-xl"
              >
                <p>{content.ourStory.content1}</p>
                <p>{content.ourStory.content2}</p>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Luxardo Ecosystem Section */}
      <section className="py-24 md:py-32 bg-brand-black text-brand-white overflow-hidden">
        <div className="max-w-[1800px] mx-auto px-8">
          <div className="max-w-3xl mb-20 space-y-6">
            <motion.p 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-[10px] uppercase tracking-[0.4em] font-bold text-brand-white/50"
            >
              {content.ecosystem.label}
            </motion.p>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl md:text-6xl font-display tracking-tight"
            >
              {content.ecosystem.heading.split(' ').map((word, i) => 
                word.toLowerCase() === 'ecosystem' ? <span key={i} className="italic"> {word}</span> : ` ${word}`
              )}
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-lg font-sans text-brand-white/60 leading-relaxed"
            >
              {content.ecosystem.subheading}
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {content.ecosystem.steps.map((item, i) => (
              <motion.div 
                key={item.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2 }}
                className="group relative bg-brand-white/5 border border-brand-white/10 p-8 hover:bg-brand-white/10 transition-colors duration-500 overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity duration-500">
                  <span className="text-8xl font-display">{item.step}</span>
                </div>
                <div className="relative z-10 space-y-8">
                  <div className="w-16 h-16 rounded-full overflow-hidden">
                    <img 
                      src={item.img} 
                      alt={item.title} 
                      className="w-full h-full object-cover grayscale"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-2xl font-display tracking-wide">{item.title}</h3>
                    <p className="text-sm font-sans text-brand-white/60 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Collections Intro Section */}
      <section className="py-24 md:py-32 bg-brand-white">
        <div className="max-w-[1800px] mx-auto px-8">
          <div className="flex flex-col md:flex-row justify-between items-end mb-24 gap-8">
            <div className="space-y-6 max-w-2xl">
              <motion.p 
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="text-[10px] uppercase tracking-[0.4em] font-bold text-brand-secondary"
              >
                {content.collections.label}
              </motion.p>
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-5xl md:text-7xl font-display tracking-tight"
              >
                {content.collections.heading.split(' ').map((word, i) => 
                  word.toLowerCase() === 'collections' ? <span key={i} className="italic"> {word}</span> : ` ${word}`
                )}
              </motion.h2>
              <motion.p 
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="text-xl font-sans text-brand-secondary leading-relaxed"
              >
                {content.collections.subheading}
              </motion.p>
            </div>
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
            >
              <Link to="/collections" className="text-[11px] uppercase tracking-[0.3em] font-bold text-brand-black border-b border-brand-black pb-2 hover:pr-4 transition-all duration-500">
                {content.collections.ctaLabel}
              </Link>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { title: 'Kurta Sets', path: '/collections/kurta-sets', img: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?q=80&w=1000&auto=format&fit=crop', size: 'large' },
              { title: 'Bandhgalas', path: '/collections/bandhgalas', img: 'https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?q=80&w=1000&auto=format&fit=crop', size: 'small' },
              { title: 'Sherwanis', path: '/collections/sherwanis', img: 'https://images.unsplash.com/photo-1598532163257-ae3c6b2524b6?q=80&w=1000&auto=format&fit=crop', size: 'small' },
              { title: 'Indo-Western', path: '/collections/indo-western', img: 'https://images.unsplash.com/photo-1621335829175-95f437384d7c?q=80&w=1000&auto=format&fit=crop', size: 'small' },
              { title: 'Jackets', path: '/collections/jackets', img: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=1000&auto=format&fit=crop', size: 'small' },
              { title: 'Wedding Wear', path: '/collections/wedding-wear', img: 'https://images.unsplash.com/photo-1550005816-091e19677788?q=80&w=1000&auto=format&fit=crop', size: 'large' },
              { title: 'Festive Wear', path: '/collections/festive-wear', img: 'https://images.unsplash.com/photo-1583391733958-d1501eq38234?q=80&w=1000&auto=format&fit=crop', size: 'small' },
              { title: 'Bespoke Services', path: '/prime-membership', img: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=1000&auto=format&fit=crop', size: 'small' }
            ].map((col, i) => (
              <Link 
                to={col.path} 
                key={col.title}
                className={`${col.size === 'large' ? 'md:col-span-2' : 'col-span-1'}`}
              >
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="group relative aspect-[4/5] overflow-hidden bg-brand-divider"
                >
                  <img 
                    src={col.img} 
                    alt={col.title} 
                    className="w-full h-full object-cover grayscale transition-transform duration-1000 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-brand-black/20 group-hover:bg-brand-black/40 transition-colors duration-500" />
                  <div className="absolute inset-0 flex flex-col justify-end p-12 translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                    <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-brand-white/60 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-500">Explore</p>
                    <h3 className="text-3xl md:text-4xl font-display text-brand-white tracking-wide">{col.title}</h3>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Vision + Mission Section */}
      <section className="py-24 md:py-32 bg-brand-bg border-y border-brand-divider">
        <div className="max-w-[1800px] mx-auto px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 md:gap-24">
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-8 bg-brand-white p-12 border border-brand-divider"
            >
              <div className="space-y-4">
                <p className="text-[10px] uppercase tracking-[0.4em] font-bold text-brand-secondary">{content.vision.label}</p>
                <h2 className="text-4xl md:text-5xl font-display tracking-tight leading-tight">
                  {content.vision.heading.split(' ').map((word, i) => 
                    (word.toLowerCase() === 'discipline' || word.toLowerCase() === 'structure' || word.toLowerCase() === '&') ? 
                    <span key={i} className="italic text-brand-black"> {word}</span> : ` ${word}`
                  )}
                </h2>
              </div>
              <p className="text-lg font-sans text-brand-secondary leading-relaxed font-light">
                {content.vision.text}
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-8 bg-brand-white p-12 border border-brand-divider"
            >
              <div className="space-y-4">
                <p className="text-[10px] uppercase tracking-[0.4em] font-bold text-brand-secondary">{content.mission.label}</p>
                <h2 className="text-4xl md:text-5xl font-display tracking-tight leading-tight">
                  {content.mission.heading.split(' ').map((word, i) => 
                    (word.toLowerCase() === 'premium' || word.toLowerCase() === 'experience') ? 
                    <span key={i} className="italic text-brand-black"> {word}</span> : ` ${word}`
                  )}
                </h2>
              </div>
              <div className="space-y-8">
                <p className="text-lg font-sans text-brand-secondary leading-relaxed font-light">
                  {content.mission.text}
                </p>
                <div className="grid grid-cols-2 gap-6 pt-6 border-t border-brand-divider">
                  {content.mission.points.map((point, i) => (
                    <div key={i} className="space-y-2">
                      <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-brand-black">{point.title}</p>
                      <p className="text-xs font-sans text-brand-secondary">{point.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
      {/* Prime Member Teaser Section */}
      <section className="py-24 md:py-32 bg-brand-black text-brand-white overflow-hidden relative">
        <div className="absolute inset-0 opacity-20">
          <img 
            src={content.prime.bgImageUrl} 
            alt="Prime Background" 
            className="w-full h-full object-cover grayscale blur-sm"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="max-w-4xl mx-auto px-8 text-center relative z-10 space-y-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="space-y-4"
          >
            <p className="text-[10px] uppercase tracking-[0.5em] font-bold text-brand-white/50">{content.prime.label}</p>
            <h2 className="text-5xl md:text-7xl font-display tracking-widest">{content.prime.heading}</h2>
          </motion.div>
          
          <motion.p 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-xl md:text-2xl font-sans text-brand-white/70 leading-relaxed font-light italic"
          >
            {content.prime.description}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="pt-8"
          >
            <Link to={content.prime.ctaLink} className="group relative px-16 py-6 overflow-hidden inline-block">
              <div className="absolute inset-0 bg-brand-white transition-transform duration-500 group-hover:scale-105" />
              <span className="relative text-brand-black text-[11px] uppercase tracking-[0.3em] font-bold">
                {content.prime.ctaText}
              </span>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Partnership Section */}
      <section className="py-24 md:py-32 bg-brand-white">
        <div className="max-w-[1800px] mx-auto px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="space-y-8"
            >
              <div className="space-y-4">
                <p className="text-[10px] uppercase tracking-[0.4em] font-bold text-brand-secondary">{content.partnership.label}</p>
                <h2 className="text-5xl md:text-7xl font-display tracking-tight">
                  {content.partnership.heading.split(' ').map((word, i) => 
                    word.toLowerCase() === 'luxardo' ? <span key={i} className="italic"> {word}</span> : ` ${word}`
                  )}
                </h2>
              </div>
              <p className="text-xl font-sans text-brand-secondary leading-relaxed max-w-xl">
                {content.partnership.text}
              </p>
              <div className="pt-4">
                <Link to="/wholesale" className="group inline-flex items-center gap-4 text-[11px] uppercase tracking-[0.3em] font-bold text-brand-black">
                  {content.partnership.ctaLabel}
                  <div className="w-8 h-[1px] bg-brand-black transition-all duration-500 group-hover:w-16" />
                </Link>
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
              className="aspect-video bg-brand-divider overflow-hidden"
            >
              <img 
                src={content.partnership.img} 
                alt="Luxardo Global Presence" 
                className="w-full h-full object-cover grayscale opacity-60 hover:opacity-100 transition-opacity duration-700"
                referrerPolicy="no-referrer"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-32 md:py-48 bg-brand-white">
        <div className="max-w-[1800px] mx-auto px-8 text-center space-y-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="space-y-6"
          >
            <h2 className="text-4xl md:text-5xl font-display tracking-tight text-brand-black">
              {content.finalCta.heading.split(' ').map((word, i) => 
                (word.toLowerCase() === 'sartorial' || word.toLowerCase() === 'journey') ? 
                <span key={i} className="italic"> {word}</span> : ` ${word}`
              )}
            </h2>
            <div className="w-12 h-[1px] bg-brand-divider mx-auto" />
          </motion.div>

          <div className="flex flex-col sm:flex-row gap-12 justify-center items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <Link to={content.finalCta.cta1Link} className="text-[11px] uppercase tracking-[0.4em] font-bold text-brand-black hover:tracking-[0.5em] transition-all duration-500 border-b border-brand-black pb-2">
                {content.finalCta.cta1Label}
              </Link>
            </motion.div>
            
            <div className="hidden sm:block w-[1px] h-8 bg-brand-divider" />

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
            >
              <Link to={content.finalCta.cta2Link} className="text-[11px] uppercase tracking-[0.4em] font-bold text-brand-black hover:tracking-[0.5em] transition-all duration-500 border-b border-brand-black pb-2">
                {content.finalCta.cta2Label}
              </Link>
            </motion.div>
          </div>
        </div>
      </section>
    </>
  );
}
