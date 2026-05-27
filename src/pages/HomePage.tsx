import React, { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence, useScroll, useTransform, useMotionValue, animate, useInView, useMotionValueEvent } from "motion/react";
import { useOutletContext, Link, useNavigate, useLocation } from "react-router-dom";
import { Country, Language } from "../types";
import { storage } from "../utils/localStorage";
import { useAuth } from "../context/AuthContext";

// Global helper to check for missing/placeholder images
const isMissingImage = (src?: string) => !src || src === '/placeholder.svg' || src.endsWith('placeholder.svg') || src.startsWith('data:');

const HERO_SLIDES = [
  {
    id: 1,
    imageUrl: '',
    heading: 'Modern Ethnic Menswear',
    subtext: 'Premium fabrics. Structured silhouettes. Crafted in Bhilwara.',
    cta: 'Shop Collections',
    link: '/collections'
  },
  {
    id: 2,
    imageUrl: '',
    heading: 'Constructed With Intent',
    subtext: 'A philosophy of slow luxury and disciplined craftsmanship.',
    cta: 'Discover Our Story',
    link: '/about'
  },
  {
    id: 3,
    imageUrl: '',
    heading: 'Designed for Every Occasion',
    subtext: 'From wedding festivities to formal excellence.',
    cta: 'View Collections',
    link: '/collections'
  }
];

const FALLBACK_STORY_STEPS = [
  {
    title: "Our Story.",
    subtitle: "Design Sketching",
    description: "From the world's finest mills to your wardrobe. A journey of uncompromising quality, expert craftsmanship, and timeless design.",
    image: "/placeholder.svg"
  },
  {
    title: "Global Sourcing",
    subtitle: "01 / Premium Fabric",
    description: "We import premium fabrics from across the entire world, meticulously selecting only the finest materials.",
    image: "/placeholder.svg"
  },
  {
    title: "Fabric Finishing",
    subtitle: "02 / Treatment",
    description: "Each fabric undergoes specialized finishing processes, enhancing its natural texture, drape, and longevity.",
    image: "/placeholder.svg"
  },
  {
    title: "Personalized Sketching",
    subtitle: "03 / Design",
    description: "Our master designers sketch personalized, bespoke designs, translating your vision into detailed sartorial blueprints.",
    image: "/placeholder.svg"
  },
  {
    title: "Expert Craftsmanship",
    subtitle: "04 / Tailoring",
    description: "Master tailors bring designs to life with traditional techniques refined over generations.",
    image: "/placeholder.svg"
  },
  {
    title: "Ready For You",
    subtitle: "05 / Box Packing",
    description: "The journey concludes with the ready-to-stitch fabric elegantly folded and secured in our premium box packing.",
    image: "/placeholder.svg"
  }
];

// Fixed 3D Scrolling Section (Sticky Scroll)
function HomeOurStorySection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeStoryStep, setActiveStoryStep] = useState(0);

  const siteContent = storage.getSiteContent();
  const siteStorySteps = siteContent?.homepage?.storySteps;
  
  const STORY_STEPS = (siteStorySteps && siteStorySteps.length > 0) ? siteStorySteps : FALLBACK_STORY_STEPS;

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const step = Math.min(
      Math.floor(latest * STORY_STEPS.length), 
      STORY_STEPS.length - 1
    );
    if (step !== activeStoryStep) {
      setActiveStoryStep(step);
    }
  });

  const currentStep = STORY_STEPS[activeStoryStep];
  const isFirst = activeStoryStep === 0;
  const missingImage = isMissingImage(currentStep.image);

  return (
    // Height set to 300vh to ensure it stays pinned while scrolling
    <section ref={containerRef} className="bg-brand-white relative border-y border-brand-black/10" style={{ height: '300vh' }}>
      
      {/* Sticky container that holds the content on screen */}
      <div className="sticky top-0 left-0 w-full h-[100dvh] overflow-hidden flex flex-col">
        
        {/* Desktop Layout */}
        <div className="hidden md:flex max-w-[1400px] mx-auto w-full h-full items-center px-6 md:px-12">
          <div className="w-1/2 h-full flex items-center justify-center p-12">
            <div className="w-full max-w-md aspect-[3/4] relative bg-brand-bg shadow-2xl overflow-hidden">
              <AnimatePresence mode="wait">
                {missingImage ? (
                  <motion.div
                    key={`grad-${activeStoryStep}`}
                    initial={{ opacity: 0, filter: "blur(10px)", scale: 0.95 }}
                    animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
                    exit={{ opacity: 0, filter: "blur(10px)", scale: 1.05 }}
                    transition={{ duration: 0.6, ease: "easeInOut" }}
                    className="absolute inset-0 bg-gradient-to-br from-[#1c1c1c] via-brand-black to-[#0a0a0a] flex flex-col items-center justify-center p-8"
                  >
                    <span className="text-[12rem] font-display text-white/[0.05] leading-none select-none">
                      {String(activeStoryStep + 1).padStart(2, '0')}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.4em] text-white/30 text-center mt-4">LUXARDO · FASHION</span>
                  </motion.div>
                ) : (
                  <motion.img
                    key={activeStoryStep}
                    src={currentStep.image}
                    initial={{ opacity: 0, filter: "blur(10px)", scale: 0.95 }}
                    animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
                    exit={{ opacity: 0, filter: "blur(10px)", scale: 1.05 }}
                    transition={{ duration: 0.6, ease: "easeInOut" }}
                    className="absolute inset-0 w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                )}
              </AnimatePresence>
              <div className="absolute inset-0 border border-brand-black/5 pointer-events-none" />
            </div>
          </div>

          <div className="w-1/2 relative h-[60vh] flex items-center pl-16">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStoryStep}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -40 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="absolute w-full pr-12"
              >
                <div className="absolute -left-8 -top-20 text-[180px] lg:text-[220px] font-display text-brand-black/[0.03] font-bold pointer-events-none select-none leading-none z-0">
                  {isFirst ? "EST" : String(activeStoryStep).padStart(2, '0')}
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-8">
                    <span className="w-12 h-[1px] bg-brand-secondary/50"></span>
                    <span className="text-[10px] uppercase tracking-[0.4em] font-bold text-brand-secondary">{currentStep.subtitle}</span>
                  </div>
                  <h3 className="text-4xl lg:text-6xl font-display tracking-tight text-brand-black mb-8 leading-[1.1]">
                    {isFirst ? <span className="font-bold text-brand-black">Our Story.</span> : currentStep.title}
                  </h3>
                  <p className="text-lg text-brand-secondary/80 font-light leading-relaxed max-w-md">
                    {currentStep.description}
                  </p>
                  <div className="flex flex-wrap gap-6 pt-10 mt-6 border-t border-brand-black/10">
                    <Link to="/about" className="text-[10px] uppercase tracking-[0.3em] font-bold text-brand-black border-b border-brand-black pb-1 hover:opacity-70 transition-opacity">Read Full Story</Link>
                    <Link to="/craftsmanship" className="text-[10px] uppercase tracking-[0.3em] font-bold text-brand-secondary hover:text-brand-black transition-colors">View Craftsmanship</Link>
                    <Link to="/contact" className="text-[10px] uppercase tracking-[0.3em] font-bold text-brand-secondary hover:text-brand-black transition-colors">Contact Us</Link>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="md:hidden w-full h-full flex flex-col relative bg-brand-white pt-20">
          <div className="h-[40svh] w-full relative px-6 flex items-center justify-center">
            <AnimatePresence mode="wait">
              {missingImage ? (
                <motion.div
                  key={`grad-mobile-${activeStoryStep}`}
                  initial={{ opacity: 0, filter: "blur(10px)", scale: 0.95 }}
                  animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
                  exit={{ opacity: 0, filter: "blur(10px)", scale: 1.05 }}
                  transition={{ duration: 0.6, ease: "easeInOut" }}
                  className="absolute inset-0 mx-4 bg-gradient-to-br from-[#1c1c1c] via-brand-black to-[#0a0a0a] flex flex-col items-center justify-center shadow-xl"
                >
                  <span className="text-[6rem] font-display text-white/[0.05] leading-none select-none">
                    {String(activeStoryStep + 1).padStart(2, '0')}
                  </span>
                </motion.div>
              ) : (
                <motion.img
                  key={`img-mobile-${activeStoryStep}`}
                  src={currentStep.image}
                  initial={{ opacity: 0, filter: "blur(10px)", scale: 0.95 }}
                  animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
                  exit={{ opacity: 0, filter: "blur(10px)", scale: 1.05 }}
                  transition={{ duration: 0.6, ease: "easeInOut" }}
                  className="absolute inset-0 w-full h-full object-cover p-4"
                  referrerPolicy="no-referrer"
                />
              )}
            </AnimatePresence>
          </div>
          <div className="flex-1 w-full relative px-6 pt-8 pb-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={`text-mobile-${activeStoryStep}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="absolute w-[calc(100%-3rem)]"
              >
                <span className="text-[10px] uppercase tracking-[0.4em] font-bold text-brand-secondary mb-3 block">{currentStep.subtitle}</span>
                <h3 className="text-3xl font-display tracking-tight text-brand-black mb-3">
                  {isFirst ? <span className="font-bold text-brand-black">Our Story.</span> : currentStep.title}
                </h3>
                <p className="text-sm text-brand-secondary/80 font-light leading-relaxed mb-6">
                  {currentStep.description}
                </p>
                <div className="flex flex-col gap-4 pt-6 border-t border-brand-black/10">
                  <Link to="/about" className="text-[10px] uppercase tracking-[0.3em] font-bold text-brand-black border-b border-brand-black pb-1 w-fit">Read Full Story</Link>
                  <Link to="/craftsmanship" className="text-[10px] uppercase tracking-[0.3em] font-bold text-brand-secondary w-fit">View Craftsmanship</Link>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

function AnimatedCounter({ value, suffix = "", start = 0, duration = 2.5 }: { value: number, suffix?: string, start?: number, duration?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const motionValue = useMotionValue(start);
  const [display, setDisplay] = useState(start + suffix);

  useMotionValueEvent(motionValue, "change", (latest) => {
    const rounded = Math.round(latest);
    if (suffix === "k+") {
      setDisplay(rounded >= 1000 ? "1k+" : rounded.toString());
    } else {
      setDisplay(rounded + suffix);
    }
  });

  useEffect(() => {
    if (inView) {
      animate(motionValue, value, { duration, ease: "easeOut" });
    }
  }, [inView, motionValue, value, duration]);

  return <span ref={ref}>{display}</span>;
}

export default function HomePage() {
  const { selectedCountry } = useOutletContext<{ selectedCountry: Country | null; selectedLanguage: Language }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [currentCollectionSlide, setCurrentCollectionSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const [isCollectionHovered, setIsCollectionHovered] = useState(false);
  const [wholesaleLoading, setWholesaleLoading] = useState(false);
  const [wholesaleSuccess, setWholesaleSuccess] = useState(false);

  // Quota Error Fix for HomePage wholesale form
  const handleWholesaleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setWholesaleLoading(true);

    const formData = new FormData(e.currentTarget);
    
    let imageBase64 = '';
    const imageFile = formData.get('image') as File;
    if (imageFile && imageFile.size > 0) {
      try {
        imageBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(imageFile);
        });
      } catch (err) {
        console.error('Failed to read image', err);
      }
    }

    const data = {
      id: Date.now(),
      full_name: formData.get('full_name'),
      company_name: formData.get('company_name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      message: formData.get('message'),
      image: imageBase64,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      storage.addWholesaleInquiry(data);
      setWholesaleSuccess(true);
      e.currentTarget.reset();
      setTimeout(() => setWholesaleSuccess(false), 5000);
    } catch (err) {
      console.error(err);
    } finally {
      setWholesaleLoading(false);
    }
  };

  const storyRef = useRef<HTMLDivElement | null>(null);

  const { scrollYProgress: storyScrollY } = useScroll(
    storyRef.current
    ? {
        target: storyRef,
        offset: ["start start", "end end"]
      }
    : undefined
  );
  
  const siteContent = storage.getSiteContent();
  const heroSlides = siteContent.homepage.hero.slides || HERO_SLIDES;

  const statsY = useTransform(storyScrollY, [0, 1], ["50px", "-50px"]);

  useEffect(() => {
    if (isHovered || siteContent.homepage.hero.mediaType === 'video') return; 
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isHovered, heroSlides.length, siteContent.homepage.hero.mediaType]);

  useEffect(() => {
    if (isCollectionHovered) return;
    const timer = setInterval(() => {
      setCurrentCollectionSlide((prev) => (prev + 1) % (siteContent.homepage.collections.items?.length || 1));
    }, 4000);
    return () => clearInterval(timer);
  }, [isCollectionHovered, siteContent.homepage.collections.items]);

  return (
    <div className="bg-brand-bg text-brand-black">
      <section
        className="relative min-h-[100dvh] md:min-h-0 md:h-[92vh] overflow-hidden bg-brand-black"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Emporio Armani Campaign Video (No sound, auto loop) */}
        <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden">
            {/* The iframe covers the background. Pointer-events-none makes sure it can't be clicked/paused */}
            <iframe 
                src="https://www.youtube.com/embed/1zOfwTVrcbE?autoplay=1&mute=1&loop=1&playlist=1zOfwTVrcbE&controls=0&showinfo=0&rel=0&modestbranding=1" 
                title="Laxardo Fashion Background Video"
                className="absolute top-1/2 left-1/2 w-[100vw] h-[56.25vw] min-h-[100vh] min-w-[177.77vh] -translate-x-1/2 -translate-y-1/2 object-cover opacity-60"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen
                style={{ pointerEvents: 'none' }}
            ></iframe>
        </div>

        {/* Hero content — LEFT-MIDDLE aligned (matches reference) */}
        <div className="absolute inset-0 flex flex-col items-start justify-center text-brand-white text-left px-6 md:px-16 lg:px-24 z-30 pt-20 md:pt-0">
          <div className="w-full max-w-2xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={`content-${siteContent.homepage.hero.mediaType === 'video' ? 'video' : currentSlide}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col items-start gap-6 md:gap-8"
              >
                <div className="flex items-center gap-3 opacity-90">
                  <span className="w-10 md:w-14 h-[1px] bg-white/60"></span>
                  <span className="text-[9px] md:text-[11px] uppercase tracking-[0.4em] font-bold text-white/70">LUXARDO · FASHION</span>
                </div>
                <h1 className="text-4xl md:text-6xl lg:text-8xl font-display tracking-tight leading-[1.05] font-light drop-shadow-lg">
                  {heroSlides[currentSlide].heading || siteContent.homepage.hero.title}
                </h1>
                {(heroSlides[currentSlide].subtext || siteContent.homepage.hero.subtitle) && (
                  <p className="text-sm md:text-lg text-white/90 font-light max-w-md leading-relaxed drop-shadow-md">
                    {heroSlides[currentSlide].subtext || siteContent.homepage.hero.subtitle}
                  </p>
                )}
                <Link
                  to={heroSlides[currentSlide].link || siteContent.homepage.hero.primaryCtaLink || '/collections'}
                  className="mt-2 inline-flex items-center gap-3 bg-white text-brand-black px-8 md:px-10 py-4 text-[10px] md:text-[11px] uppercase tracking-[0.3em] font-bold hover:bg-white/90 transition-colors"
                >
                  {heroSlides[currentSlide].cta || siteContent.homepage.hero.primaryCtaText || 'Discover the Collection'}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Link>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {siteContent.homepage.hero.mediaType !== 'video' && (
          <div className="absolute bottom-8 md:bottom-12 left-1/2 -translate-x-1/2 flex gap-3 md:gap-4 z-40">
            {heroSlides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className="group p-2"
                aria-label={`Go to slide ${index + 1}`}
              >
                <div className={`h-[1.5px] transition-all duration-500 ${
                  currentSlide === index ? 'w-8 md:w-12 bg-brand-white' : 'w-4 md:w-6 bg-brand-white/30 group-hover:bg-brand-white/60'
                }`} />
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="w-full bg-brand-black border-t border-brand-white/10 py-4 md:py-6">
        <div className="max-w-[1600px] mx-auto px-4">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3 md:gap-12 text-center">
            <span className="text-[9px] md:text-xs uppercase tracking-[0.2em] md:tracking-[0.3em] font-bold text-brand-white/80 whitespace-nowrap">Ready to Stitch Fabric</span>
            <span className="hidden md:block w-1 h-1 rounded-full bg-brand-white/30"></span>
            <span className="text-[9px] md:text-xs uppercase tracking-[0.2em] md:tracking-[0.3em] font-bold text-brand-white/80 whitespace-nowrap">Full Customization</span>
            <span className="hidden md:block w-1 h-1 rounded-full bg-brand-white/30"></span>
            <span className="text-[9px] md:text-xs uppercase tracking-[0.2em] md:tracking-[0.3em] font-bold text-brand-white/80 whitespace-nowrap">Available for Bulk Quantity</span>
          </div>
        </div>
      </div>

      <section className="bg-[#F8F8F8] py-16 md:py-28 overflow-hidden border-t border-brand-black/10">
        <div className="max-w-[1600px] mx-auto px-4 md:px-12">
          <div className="text-center flex flex-col items-center">
            <span className="w-[1px] h-12 md:h-16 bg-brand-black/20 mb-6 md:mb-8"></span>
            <p className="text-[10px] uppercase tracking-[0.5em] font-bold text-brand-secondary mb-4 md:mb-6">{siteContent.homepage.collections.label}</p>
            <h2 className="text-4xl md:text-7xl font-display tracking-tight text-brand-black">{siteContent.homepage.collections.heading}</h2>
            <p className="text-xs md:text-sm text-brand-secondary/70 mt-6 max-w-md mx-auto font-light">Seven categories. Scroll to explore each in detail.</p>
          </div>
        </div>
      </section>

      <div className="relative bg-brand-black">
        {(siteContent.homepage.collections.items || []).map((collection: any, index: number) => {
          const missingImage = isMissingImage(collection.image);
          const isLeft = index % 2 === 0;
          const total = siteContent.homepage.collections.items?.length || 1;
          return (
            <section
              key={`hero-${collection.id}`}
              className="relative min-h-[75vh] md:min-h-0 md:h-screen w-full overflow-hidden bg-brand-black"
            >
              {missingImage ? (
                <div className="absolute inset-0 bg-gradient-to-br from-[#1c1c1c] via-brand-black to-[#0a0a0a]">
                  <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{
                    backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
                    backgroundSize: '80px 80px'
                  }} />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-[55vw] md:text-[40vw] font-display text-white/[0.05] leading-none tracking-tighter select-none">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  <motion.img
                    initial={{ scale: 1.15 }}
                    whileInView={{ scale: 1 }}
                    transition={{ duration: 2, ease: 'easeOut' }}
                    viewport={{ once: true, amount: 0.1 }}
                    src={collection.image}
                    alt={collection.title}
                    className="absolute inset-0 w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-brand-black/40 via-brand-black/60 to-brand-black/90 md:bg-gradient-to-br md:from-brand-black/70 md:via-brand-black/30 md:to-brand-black/70" />
                </>
              )}

              <div className={`absolute inset-0 flex flex-col items-center md:items-${isLeft ? 'start' : 'end'} justify-end md:justify-center pb-24 md:pb-0 px-6 md:px-16 lg:px-32 z-10 text-center md:text-${isLeft ? 'left' : 'right'}`}>
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                  className="max-w-2xl w-full"
                >
                  <div className={`flex items-center gap-4 mb-4 md:mb-8 justify-center md:justify-${isLeft ? 'start' : 'end'}`}>
                    <span className="w-8 md:w-16 h-[1px] bg-white/60"></span>
                    <span className="text-[10px] md:text-xs uppercase tracking-[0.4em] font-bold text-white/70">
                      Collection {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
                    </span>
                  </div>
                  <h3 className="text-4xl md:text-7xl lg:text-8xl font-display font-light tracking-tight text-white mb-4 md:mb-10 leading-[1.05]">
                    {collection.title}
                  </h3>
                  {collection.descriptor && (
                    <p className="text-sm md:text-xl text-white/80 font-light max-w-xl mx-auto md:mx-0 leading-relaxed mb-8 md:mb-12">
                      {collection.descriptor}
                    </p>
                  )}
                  <Link
                    to={collection.link}
                    className="inline-flex items-center justify-center gap-3 bg-white text-brand-black px-8 md:px-10 py-3.5 md:py-4 w-full md:w-auto text-[10px] md:text-[11px] uppercase tracking-[0.3em] font-bold hover:bg-white/90 transition-colors group"
                  >
                    Explore {collection.title}
                    <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Link>
                </motion.div>
              </div>

              <div className="hidden md:flex absolute right-8 top-1/2 -translate-y-1/2 flex-col gap-3 z-20">
                {(siteContent.homepage.collections.items || []).map((_: any, dotIdx: number) => (
                  <div
                    key={dotIdx}
                    className={`transition-all duration-500 ${
                      dotIdx === index
                        ? 'w-1 h-8 bg-white'
                        : 'w-1 h-2 bg-white/30'
                    }`}
                  />
                ))}
              </div>

              {index === 0 && (
                <div className="absolute bottom-8 md:bottom-12 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 animate-bounce">
                  <span className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-white/60">Scroll</span>
                  <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <section className="hidden">
        <div className="md:hidden flex overflow-hidden relative w-full -mx-4 px-4 py-8 bg-[#f8f8f8]">
          <motion.div 
            className="flex gap-4 w-max"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ repeat: Infinity, ease: "linear", duration: 25 }}
          >
            {[...(siteContent.homepage.collections.items || []), ...(siteContent.homepage.collections.items || [])].map((collection: any, index: number) => {
              const missingImage = isMissingImage(collection.image);
              const displayIndex = (index % (siteContent.homepage.collections.items?.length || 1)) + 1;
              return (
                <Link
                  key={`mobile-${index}`}
                  to={collection.link}
                  className="group relative bg-brand-white p-2 border border-brand-black/10 shadow-sm w-[280px] aspect-[4/5] flex-shrink-0"
                >
                  <div className="relative w-full h-full overflow-hidden bg-brand-black">
                    {missingImage ? (
                      <div className="absolute inset-0 bg-gradient-to-br from-[#1c1c1c] via-brand-black to-[#0a0a0a] flex items-start justify-end p-4">
                        <span className="text-[8rem] font-display text-white/[0.06] leading-none tracking-tighter select-none -mt-2">
                          {String(displayIndex).padStart(2, '0')}
                        </span>
                      </div>
                    ) : (
                      <>
                        <img
                          src={collection.image}
                          alt={collection.title}
                          className="w-full h-full object-cover opacity-90"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-brand-black/90 via-brand-black/20 to-transparent pointer-events-none" />
                      </>
                    )}

                    <div className="absolute bottom-0 left-0 w-full p-4 flex flex-col justify-end">
                      <div className="flex items-end justify-between">
                        <div>
                          <span className="text-[8px] uppercase tracking-[0.4em] font-bold text-brand-white/70 mb-1.5 block">
                            0{displayIndex} / Collection
                          </span>
                          <h3 className="text-xl font-display text-brand-white">
                            {collection.title}
                          </h3>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* FIXED: The 3D Scroll Section */}
      <HomeOurStorySection />

      <section className="bg-brand-white pb-16 md:pb-24 pt-8 md:pt-12 overflow-hidden">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <motion.div 
            style={{ y: statsY }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 md:gap-8 pt-8 md:pt-12 border-t border-brand-black/10"
          >
            <div className="text-center flex flex-col items-center">
              <span className="text-4xl md:text-6xl lg:text-7xl font-display font-light text-brand-black mb-2 md:mb-4">
                <AnimatedCounter value={2015} start={2000} duration={2} />
              </span>
              <span className="text-[9px] md:text-[10px] uppercase tracking-[0.2em] md:tracking-[0.3em] font-bold text-brand-secondary">Year Established</span>
            </div>
            <div className="text-center flex flex-col items-center">
              <span className="text-4xl md:text-6xl lg:text-7xl font-display font-light text-brand-black mb-2 md:mb-4">
                <AnimatedCounter value={500} suffix="+" duration={2.5} />
              </span>
              <span className="text-[9px] md:text-[10px] uppercase tracking-[0.2em] md:tracking-[0.3em] font-bold text-brand-secondary">Employees</span>
            </div>
            <div className="text-center flex flex-col items-center">
              <span className="text-4xl md:text-6xl lg:text-7xl font-display font-light text-brand-black mb-2 md:mb-4">
                <AnimatedCounter value={26} suffix="+" duration={2} />
              </span>
              <span className="text-[9px] md:text-[10px] uppercase tracking-[0.2em] md:tracking-[0.3em] font-bold text-brand-secondary">States Covered</span>
            </div>
            <div className="text-center flex flex-col items-center">
              <span className="text-4xl md:text-6xl lg:text-7xl font-display font-light text-brand-black mb-2 md:mb-4">
                <AnimatedCounter value={3} suffix="+" duration={1.5} />
              </span>
              <span className="text-[9px] md:text-[10px] uppercase tracking-[0.2em] md:tracking-[0.3em] font-bold text-brand-secondary">Countries Reached</span>
            </div>
            <div className="text-center flex flex-col items-center col-span-2 md:col-span-1 lg:col-span-1">
              <span className="text-4xl md:text-6xl lg:text-7xl font-display font-light text-brand-black mb-2 md:mb-4">
                <AnimatedCounter value={700} suffix="+" duration={2.5} />
              </span>
              <span className="text-[9px] md:text-[10px] uppercase tracking-[0.2em] md:tracking-[0.3em] font-bold text-brand-secondary">Partner</span>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-16 md:py-32 bg-brand-bg border-y border-brand-divider">
        <div className="max-w-[1800px] mx-auto px-4 md:px-8">
          <div className="text-center mb-12 md:mb-20 space-y-4">
            <p className="text-[10px] uppercase tracking-[0.4em] font-bold text-brand-secondary">The Experience</p>
            <h2 className="text-3xl md:text-5xl font-display tracking-tight">Choose Your Journey</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border border-brand-divider">
            <div className="p-8 md:p-20 border-b md:border-b-0 md:border-r border-brand-divider bg-brand-white">
              <h3 className="text-2xl md:text-3xl font-display mb-4 md:mb-6">Direct Collection</h3>
              <p className="text-sm md:text-base text-brand-secondary font-light leading-relaxed mb-8 md:mb-12">
                Access our curated seasonal collections. Ready to wear, crafted with the same attention to detail and premium fabrics that define the LUXARDO FASHION name.
              </p>
              <ul className="space-y-3 md:space-y-4 mb-8 md:mb-12 text-xs md:text-sm font-sans text-brand-black">
                <li className="flex items-center gap-4"><span className="w-1.5 h-1.5 bg-brand-black rounded-full" /> Standard sizing</li>
                <li className="flex items-center gap-4"><span className="w-1.5 h-1.5 bg-brand-black rounded-full" /> Seasonal collections</li>
                <li className="flex items-center gap-4"><span className="w-1.5 h-1.5 bg-brand-black rounded-full" /> Global shipping</li>
              </ul>
              <Link to="/collections" className="inline-block text-[10px] uppercase tracking-[0.3em] font-bold text-brand-black border-b border-brand-black pb-1 hover:pr-4 transition-all duration-500">
                Shop Collections
              </Link>
            </div>
            
            <div className="p-8 md:p-20 bg-brand-black text-brand-white">
              <h3 className="text-2xl md:text-3xl font-display mb-4 md:mb-6 text-brand-white">Prime Membership</h3>
              <p className="text-sm md:text-base text-brand-white/70 font-light leading-relaxed mb-8 md:mb-12">
                The ultimate bespoke experience. Gain access to our private fabric library, priority tailoring, and dedicated style consultations.
              </p>
              <ul className="space-y-3 md:space-y-4 mb-8 md:mb-12 text-xs md:text-sm font-sans text-brand-white/90">
                <li className="flex items-center gap-4"><span className="w-1.5 h-1.5 bg-brand-white rounded-full" /> Bespoke measurements</li>
                <li className="flex items-center gap-4"><span className="w-1.5 h-1.5 bg-brand-white rounded-full" /> Private fabric library access</li>
                <li className="flex items-center gap-4"><span className="w-1.5 h-1.5 bg-brand-white rounded-full" /> Dedicated style consultant</li>
                <li className="flex items-center gap-4"><span className="w-1.5 h-1.5 bg-brand-white rounded-full" /> Priority production</li>
              </ul>
              <Link to="/prime-membership" className="inline-block text-[10px] uppercase tracking-[0.3em] font-bold text-brand-white border-b border-brand-white pb-1 hover:pr-4 transition-all duration-500">
                Discover Prime
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="relative py-20 md:py-32 overflow-hidden bg-gradient-to-br from-[#1c1c1c] via-brand-black to-[#0a0a0a]">
        {!isMissingImage(siteContent.homepage.partnership?.img) && (
          <motion.div
            initial={{ scale: 1.1 }}
            whileInView={{ scale: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            viewport={{ once: true }}
            className="absolute inset-0"
          >
            <img
              src={siteContent.homepage.partnership.img}
              alt="Partner with us"
              className="w-full h-full object-cover opacity-40"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-brand-black via-brand-black/90 to-brand-black/40" />
          </motion.div>
        )}
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }} />
        
        <div className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="max-w-2xl">
            <div className="flex items-center gap-4 mb-6 md:mb-8">
              <span className="w-8 md:w-12 h-[1px] bg-brand-white/50"></span>
              <span className="text-[10px] uppercase tracking-[0.4em] font-bold text-brand-white/80">B2B & Wholesale</span>
            </div>
            <h2 className="text-4xl md:text-7xl font-display tracking-tight text-brand-white mb-6 md:mb-8 leading-[1.1]">
              Elevate Your <br />
              <span className="italic font-light text-brand-white/70">Retail Experience.</span>
            </h2>
            <p className="text-sm md:text-lg text-brand-white/70 font-light leading-relaxed mb-8 md:mb-12 max-w-lg">
              Join our exclusive network of retail partners. Offer your clients the unparalleled craftsmanship and timeless elegance of LUXARDO FASHION.
            </p>
          </div>

          <div className="bg-brand-white/5 backdrop-blur-md border border-brand-white/10 p-8 md:p-12">
            <h3 className="text-2xl font-display text-brand-white mb-8">Apply for Partnership</h3>
            <form onSubmit={handleWholesaleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-brand-white/70 font-bold">Full Name</label>
                  <input required name="full_name" type="text" className="w-full bg-transparent border-b border-brand-white/20 pb-2 text-brand-white focus:border-brand-white focus:outline-none transition-colors rounded-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-brand-white/70 font-bold">Company Name</label>
                  <input required name="company_name" type="text" className="w-full bg-transparent border-b border-brand-white/20 pb-2 text-brand-white focus:border-brand-white focus:outline-none transition-colors rounded-none" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-brand-white/70 font-bold">Email</label>
                  <input required name="email" type="email" className="w-full bg-transparent border-b border-brand-white/20 pb-2 text-brand-white focus:border-brand-white focus:outline-none transition-colors rounded-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-brand-white/70 font-bold">Phone</label>
                  <input required name="phone" type="tel" className="w-full bg-transparent border-b border-brand-white/20 pb-2 text-brand-white focus:border-brand-white focus:outline-none transition-colors rounded-none" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-brand-white/70 font-bold">Message</label>
                <textarea required name="message" rows={3} className="w-full bg-transparent border-b border-brand-white/20 pb-2 text-brand-white focus:border-brand-white focus:outline-none transition-colors resize-none rounded-none"></textarea>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-brand-white/70 font-bold">Storefront / Business Image</label>
                <input required name="image" type="file" accept="image/*" className="w-full bg-transparent border-b border-brand-white/20 pb-2 text-brand-white focus:border-brand-white focus:outline-none transition-colors rounded-none file:mr-4 file:py-2 file:px-4 file:border-0 file:text-[10px] file:uppercase file:tracking-widest file:font-bold file:bg-brand-white file:text-brand-black hover:file:bg-brand-white/90 cursor-pointer" />
              </div>
              <button 
                type="submit" 
                disabled={wholesaleLoading}
                className="btn-primary w-full py-4 text-[10px] uppercase tracking-[0.3em] font-bold"
              >
                {wholesaleLoading ? 'Submitting...' : 'Submit Application'}
              </button>
              {wholesaleSuccess && (
                <p className="text-emerald-400 text-sm text-center mt-4">Application received successfully. We will contact you soon.</p>
              )}
            </form>
          </div>
        </div>
      </section>

      <section className="py-12 md:py-24 bg-brand-white">
        <div className="max-w-[1200px] mx-auto px-4 md:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 border border-brand-black/20 relative">
            
            <div className="absolute -top-1 -left-1 w-2 h-2 border-t border-l border-brand-black"></div>
            <div className="absolute -top-1 -right-1 w-2 h-2 border-t border-r border-brand-black"></div>
            <div className="absolute -bottom-1 -left-1 w-2 h-2 border-b border-l border-brand-black"></div>
            <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b border-r border-brand-black"></div>

            <motion.div 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="p-6 md:p-12 lg:p-16 border-b lg:border-b-0 lg:border-r border-brand-black/20 bg-[#FAFAFA] flex flex-col justify-center relative overflow-hidden"
            >
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
              
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-4 md:mb-6">
                  <span className="w-6 h-[1px] bg-brand-black"></span>
                  <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-brand-black">
                    {siteContent.homepage.vision?.label || 'The Vision'}
                  </span>
                </div>
                <h2 className="text-2xl md:text-4xl font-display tracking-tight text-brand-black mb-4 md:mb-6 leading-[1.1]">
                  {siteContent.homepage.vision?.heading || 'A Return to Discipline & Structure'}
                </h2>
                <p className="text-sm md:text-base text-brand-secondary/80 font-light leading-relaxed">
                  {siteContent.homepage.vision?.text || 'We envision a world where menswear is defined by architectural precision and sartorial integrity. A return to the disciplined lines and refined structures that define the modern gentleman.'}
                </p>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="p-6 md:p-12 lg:p-16 bg-white flex flex-col justify-center"
            >
              <div className="flex items-center gap-4 mb-4 md:mb-6">
                <span className="w-6 h-[1px] bg-brand-black"></span>
                <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-brand-black">
                  {siteContent.homepage.mission?.label || 'The Mission'}
                </span>
              </div>
              <h2 className="text-2xl md:text-4xl font-display tracking-tight text-brand-black mb-4 md:mb-6 leading-[1.1]">
                {siteContent.homepage.mission?.heading || 'Crafting the Premium Experience'}
              </h2>
              <p className="text-sm md:text-base text-brand-secondary/80 font-light leading-relaxed mb-6 md:mb-8">
                {siteContent.homepage.mission?.text || 'Our mission is to create a premium menswear experience through the meticulous selection of fabrics, elegant design discipline, careful presentation, and thoughtful service.'}
              </p>
              
              {siteContent.homepage.mission?.points && siteContent.homepage.mission.points.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 pt-6 md:pt-8 border-t border-brand-black/10">
                  {siteContent.homepage.mission.points.map((point: any, idx: number) => (
                    <div key={idx} className="space-y-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[9px] font-mono text-brand-black/40">0{idx + 1}</span>
                        <h4 className="text-[10px] md:text-xs font-bold tracking-widest text-brand-black uppercase">{point.title}</h4>
                      </div>
                      <p className="text-[11px] md:text-xs text-brand-secondary/70 font-light leading-relaxed">
                        {point.desc}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

          </div>
        </div>
      </section>

    </div>
  );
}