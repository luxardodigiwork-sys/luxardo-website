import React, { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence, useScroll, useTransform, useMotionValue, animate, useInView, useMotionValueEvent } from "framer-motion";
import { useOutletContext, Link, useNavigate, useLocation } from "react-router-dom";
import { Country, Language } from "../types";
import { storage } from "../utils/localStorage";
import { useAuth } from "../context/AuthContext";
import { db } from '../firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { subscribeSiteContent } from '../utils/siteContentSync';

const isMissingImage = (src?: string) => !src || src === '/placeholder.svg' || src.endsWith('placeholder.svg') || src.startsWith('data:');

const HERO_SLIDES = [
  { id: 1, imageUrl: '', heading: 'Modern Ethnic Menswear', subtext: 'Premium fabrics. Structured silhouettes. Crafted in Bhilwara.', cta: 'Shop Collections', link: '/collections' }
];

const FALLBACK_STORY_STEPS = [
  { title: "Our Story.", subtitle: "Design Sketching", description: "From the world's finest mills to your wardrobe.", image: "/placeholder.svg" }
];

function HomeOurStorySection({ siteContent }: { siteContent: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeStoryStep, setActiveStoryStep] = useState(0);

  const siteStorySteps = siteContent?.homepage?.storySteps;
  const STORY_STEPS = (siteStorySteps && siteStorySteps.length > 0) ? siteStorySteps : FALLBACK_STORY_STEPS;

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const step = Math.min(Math.floor(latest * STORY_STEPS.length), STORY_STEPS.length - 1);
    if (step !== activeStoryStep) setActiveStoryStep(step);
  });

  const currentStep = STORY_STEPS[activeStoryStep];
  const isFirst = activeStoryStep === 0;
  const missingImage = isMissingImage(currentStep?.image);

  return (
    <section ref={containerRef} className="bg-brand-white relative border-y border-brand-black/10" style={{ height: '300vh' }}>
      <div className="sticky top-0 left-0 w-full h-[100dvh] overflow-hidden flex flex-col">
        <div className="hidden md:flex max-w-[1400px] mx-auto w-full h-full items-center px-6 md:px-12">
          <div className="w-1/2 h-full flex items-center justify-center p-12">
            <div className="w-full max-w-md aspect-[3/4] relative bg-brand-bg shadow-2xl overflow-hidden">
              <AnimatePresence mode="wait">
                {missingImage ? (
                  <motion.div key={`grad-${activeStoryStep}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-gradient-to-br from-[#1c1c1c] via-brand-black to-[#0a0a0a] flex flex-col items-center justify-center p-8">
                    <span className="text-[12rem] font-display text-white/[0.05] leading-none select-none">{String(activeStoryStep + 1).padStart(2, '0')}</span>
                  </motion.div>
                ) : (
                  <motion.img key={activeStoryStep} src={currentStep.image} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} transition={{ duration: 0.6 }} className="absolute inset-0 w-full h-full object-cover" />
                )}
              </AnimatePresence>
              <div className="absolute inset-0 border border-brand-black/5 pointer-events-none" />
            </div>
          </div>
          <div className="w-1/2 relative h-[60vh] flex items-center pl-16">
            <AnimatePresence mode="wait">
              <motion.div key={activeStoryStep} initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -40 }} className="absolute w-full pr-12">
                <div className="absolute -left-8 -top-20 text-[180px] lg:text-[220px] font-display text-brand-black/[0.03] font-bold pointer-events-none select-none leading-none z-0">{isFirst ? "EST" : String(activeStoryStep).padStart(2, '0')}</div>
                <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-8"><span className="w-12 h-[1px] bg-brand-secondary/50"></span><span className="text-[10px] uppercase tracking-[0.4em] font-bold text-brand-secondary">{currentStep.subtitle}</span></div>
                  <h3 className="text-4xl lg:text-6xl font-display tracking-tight text-brand-black mb-8 leading-[1.1]">{isFirst ? <span className="font-bold text-brand-black">Our Story.</span> : currentStep.title}</h3>
                  <p className="text-lg text-brand-secondary/80 font-light leading-relaxed max-w-md">{currentStep.description}</p>
                  <div className="flex flex-wrap gap-6 pt-10 mt-6 border-t border-brand-black/10">
                    <Link to="/about" className="text-[10px] uppercase tracking-[0.3em] font-bold text-brand-black border-b border-brand-black pb-1">Read Full Story</Link>
                    <Link to="/craftsmanship" className="text-[10px] uppercase tracking-[0.3em] font-bold text-brand-secondary">View Craftsmanship</Link>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="md:hidden w-full h-full flex flex-col relative bg-brand-white pt-20">
          <div className="h-[40svh] w-full relative px-6 flex items-center justify-center">
            <AnimatePresence mode="wait">
              {missingImage ? (
                <motion.div key={`grad-mobile-${activeStoryStep}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 mx-4 bg-gradient-to-br from-[#1c1c1c] via-brand-black to-[#0a0a0a] flex items-center justify-center shadow-xl">
                  <span className="text-[6rem] font-display text-white/[0.05] leading-none select-none">{String(activeStoryStep + 1).padStart(2, '0')}</span>
                </motion.div>
              ) : (
                <motion.img key={`img-mobile-${activeStoryStep}`} src={currentStep.image} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 w-full h-full object-cover p-4" />
              )}
            </AnimatePresence>
          </div>
          <div className="flex-1 w-full relative px-6 pt-8 pb-4">
            <AnimatePresence mode="wait">
              <motion.div key={`text-mobile-${activeStoryStep}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="absolute w-[calc(100%-3rem)]">
                <span className="text-[10px] uppercase tracking-[0.4em] font-bold text-brand-secondary mb-3 block">{currentStep.subtitle}</span>
                <h3 className="text-3xl font-display tracking-tight text-brand-black mb-3">{isFirst ? <span className="font-bold text-brand-black">Our Story.</span> : currentStep.title}</h3>
                <p className="text-sm text-brand-secondary/80 font-light leading-relaxed mb-6">{currentStep.description}</p>
                <div className="flex flex-col gap-4 pt-6 border-t border-brand-black/10">
                  <Link to="/about" className="text-[10px] uppercase tracking-[0.3em] font-bold text-brand-black border-b border-brand-black pb-1 w-fit">Read Full Story</Link>
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
    if (suffix === "k+") setDisplay(rounded >= 1000 ? "1k+" : rounded.toString());
    else setDisplay(rounded + suffix);
  });

  useEffect(() => {
    if (inView) animate(motionValue, value, { duration, ease: "easeOut" });
  }, [inView, motionValue, value, duration]);

  return <span ref={ref}>{display}</span>;
}

export default function HomePage() {
  const { selectedCountry } = useOutletContext<{ selectedCountry: Country | null; selectedLanguage: Language }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [wholesaleLoading, setWholesaleLoading] = useState(false);
  const [wholesaleSuccess, setWholesaleSuccess] = useState(false);
  
  // LIVE FIREBASE SYNC FOR CONTENT
  const [siteContent, setSiteContent] = useState(storage.getSiteContent());
  // 🚀 MASTER FIX: LIVE FIREBASE SYNC FOR COLLECTIONS (Directly from Admin)
  const [liveCollections, setLiveCollections] = useState<any[]>([]);
  
  useEffect(() => {
    const unsubscribe = subscribeSiteContent((content) => {
      if (content) setSiteContent(content);
    });

    // Fetch REAL collections from Firestore 'categories'
    const fetchLiveCollections = async () => {
      try {
        const snap = await getDocs(collection(db, 'categories'));
        const cats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        cats.sort((a: any, b: any) => a.sortOrder - b.sortOrder);
        setLiveCollections(cats.filter((c: any) => c.isVisible));
      } catch (err) {
        console.error("Failed to load live collections", err);
      }
    };
    fetchLiveCollections();

    return () => unsubscribe();
  }, []);

  const heroSlides = siteContent?.homepage?.hero?.slides || HERO_SLIDES;

  const storyRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress: storyScrollY } = useScroll({ target: storyRef, offset: ["start start", "end end"] });
  const statsY = useTransform(storyScrollY, [0, 1], ["50px", "-50px"]);

  useEffect(() => {
    if (isHovered || siteContent?.homepage?.hero?.mediaType === 'video') return; 
    const timer = setInterval(() => setCurrentSlide((prev) => (prev + 1) % heroSlides.length), 5000);
    return () => clearInterval(timer);
  }, [isHovered, heroSlides.length, siteContent?.homepage?.hero?.mediaType]);

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = (error) => reject(error);
      };
    });
  };

  const handleWholesaleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setWholesaleLoading(true);

    const formData = new FormData(e.currentTarget);
    let imageBase64 = '';
    const imageFile = formData.get('image') as File;
    if (imageFile && imageFile.size > 0) {
      try {
        imageBase64 = await compressImage(imageFile);
      } catch (err) {
        console.error('Failed to compress image', err);
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
      await addDoc(collection(db, 'wholesaleInquiries'), data);
      setWholesaleSuccess(true);
      e.currentTarget.reset();
      setTimeout(() => setWholesaleSuccess(false), 5000);
    } catch (err) {
      console.error(err);
    } finally {
      setWholesaleLoading(false);
    }
  };

  if (!siteContent) return null;

  return (
    <div className="bg-brand-bg text-brand-black">
      <section className="relative min-h-[100dvh] md:min-h-0 md:h-[92vh] overflow-hidden bg-brand-black" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
        {siteContent.homepage.hero.mediaType === 'video' && siteContent.homepage.hero.videoUrl ? (
          // ── MODE: Custom video loop ──
          <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden">
            <video
              className="absolute top-1/2 left-1/2 w-full h-full object-cover -translate-x-1/2 -translate-y-1/2"
              src={siteContent.homepage.hero.videoUrl}
              autoPlay muted loop playsInline
            />
            <div className="absolute inset-0 bg-gradient-to-b from-brand-black/30 via-brand-black/10 to-brand-black/70 pointer-events-none" />
          </div>
        ) : isMissingImage(heroSlides[currentSlide]?.imageUrl) ? (
          // ── MODE: Image slides — typography fallback when no image uploaded ──
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a] via-brand-black to-[#0d0d0d]">
            <div className="absolute inset-0 opacity-[0.06]" style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
              backgroundSize: '80px 80px',
            }} />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-[40vw] md:text-[28vw] font-display text-white/[0.04] leading-none tracking-tighter select-none">L</span>
            </div>
          </div>
        ) : (
          // ── MODE: Image slides — real images carousel ──
          <AnimatePresence mode="wait">
            <motion.div
              key={heroSlides[currentSlide]?.id || currentSlide}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5, ease: 'easeInOut' }}
              className="absolute inset-0"
            >
              <img
                src={heroSlides[currentSlide].imageUrl}
                alt={heroSlides[currentSlide].heading || 'LUXARDO'}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-brand-black/40 via-brand-black/15 to-brand-black/80 pointer-events-none" />
            </motion.div>
          </AnimatePresence>
        )}
        <div className="absolute inset-0 flex flex-col items-start justify-center text-brand-white text-left px-6 md:px-16 lg:px-24 z-30 pt-20 md:pt-0">
          <div className="w-full max-w-2xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={`content-${siteContent.homepage.hero.mediaType === 'video' ? 'video' : currentSlide}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.8 }}
                className="flex flex-col items-start gap-6 md:gap-8"
              >
                <div className="flex items-center gap-3 opacity-90">
                  <span className="w-10 md:w-14 h-[1px] bg-white/60"></span>
                  <span className="text-[9px] md:text-[11px] uppercase tracking-[0.4em] font-bold text-white/70">LUXARDO · FASHION</span>
                </div>
                <h1 className="text-4xl md:text-6xl lg:text-8xl font-display tracking-tight leading-[1.05] font-light drop-shadow-lg">
                  {heroSlides[currentSlide]?.heading || siteContent.homepage.hero.title || 'LUXARDO'}
                </h1>
                {(heroSlides[currentSlide]?.subtext || siteContent.homepage.hero.subtitle) && (
                  <p className="text-sm md:text-lg text-white/90 font-light max-w-md leading-relaxed drop-shadow-md">
                    {heroSlides[currentSlide]?.subtext || siteContent.homepage.hero.subtitle}
                  </p>
                )}
                <Link
                  to={heroSlides[currentSlide]?.link || siteContent.homepage.hero.primaryCtaLink || '/collections'}
                  className="mt-2 inline-flex items-center gap-3 bg-white text-brand-black px-8 md:px-10 py-4 text-[10px] md:text-[11px] uppercase tracking-[0.3em] font-bold hover:bg-white/90 transition-colors"
                >
                  {heroSlides[currentSlide]?.cta || siteContent.homepage.hero.primaryCtaText || 'Discover the Collection'}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Link>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </section>

      <section className="bg-[#F8F8F8] py-16 md:py-28 overflow-hidden border-t border-brand-black/10">
        <div className="max-w-[1600px] mx-auto px-4 md:px-12 text-center flex flex-col items-center">
          <span className="w-[1px] h-12 md:h-16 bg-brand-black/20 mb-6 md:mb-8"></span>
          <p className="text-[10px] uppercase tracking-[0.5em] font-bold text-brand-secondary mb-4 md:mb-6">{siteContent.homepage.collections.label || 'Collections'}</p>
          <h2 className="text-4xl md:text-7xl font-display tracking-tight text-brand-black">{siteContent.homepage.collections.heading || 'Our Masterpieces'}</h2>
        </div>
      </section>

      {/* 🚀 RENDER LIVE COLLECTIONS FROM FIREBASE */}
      <div className="relative bg-brand-black">
        {liveCollections.map((collection: any, index: number) => {
          const isLeft = index % 2 === 0;
          const total = liveCollections.length;
          // Use heroImageUrl from Firebase
          const missingImage = isMissingImage(collection.heroImageUrl);
          return (
            <section key={collection.id} className="relative min-h-[75vh] md:min-h-0 md:h-screen w-full overflow-hidden bg-brand-black">
              {missingImage ? (
                <div className="absolute inset-0 bg-gradient-to-br from-[#1c1c1c] via-brand-black to-[#0a0a0a] flex items-center justify-center">
                  <span className="text-[55vw] md:text-[40vw] font-display text-white/[0.05] leading-none tracking-tighter select-none">{String(index + 1).padStart(2, '0')}</span>
                </div>
              ) : (
                <>
                  <motion.img initial={{ scale: 1.15 }} whileInView={{ scale: 1 }} transition={{ duration: 2, ease: 'easeOut' }} viewport={{ once: true, amount: 0.1 }} src={collection.heroImageUrl} alt={collection.name} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-b from-brand-black/40 via-brand-black/60 to-brand-black/90 md:bg-gradient-to-br md:from-brand-black/70 md:via-brand-black/30 md:to-brand-black/70" />
                </>
              )}
              <div className={`absolute inset-0 flex flex-col items-center md:items-${isLeft ? 'start' : 'end'} justify-end md:justify-center pb-24 md:pb-0 px-6 md:px-16 lg:px-32 z-10 text-center md:text-${isLeft ? 'left' : 'right'}`}>
                <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-2xl w-full">
                  <div className={`flex items-center gap-4 mb-4 md:mb-8 justify-center md:justify-${isLeft ? 'start' : 'end'}`}>
                    <span className="w-8 md:w-16 h-[1px] bg-white/60"></span>
                    <span className="text-[10px] md:text-xs uppercase tracking-[0.4em] font-bold text-white/70">Collection {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
                  </div>
                  <h3 className="text-4xl md:text-7xl lg:text-8xl font-display font-light tracking-tight text-white mb-4 md:mb-10 leading-[1.05]">{collection.name}</h3>
                  <p className="text-sm md:text-xl text-white/80 font-light max-w-xl mx-auto md:mx-0 leading-relaxed mb-8 md:mb-12">{collection.shortDescription}</p>
                  
                  {/* Link passes the SLUG perfectly */}
                  <Link to={`/collections/${collection.slug}`} className="inline-flex items-center justify-center gap-3 bg-white text-brand-black px-8 md:px-10 py-3.5 md:py-4 w-full md:w-auto text-[10px] md:text-[11px] uppercase tracking-[0.3em] font-bold hover:bg-white/90 group">Explore {collection.name}</Link>
                </motion.div>
              </div>
            </section>
          );
        })}
      </div>

      <HomeOurStorySection siteContent={siteContent} />

      <section className="bg-brand-white pb-16 md:pb-24 pt-8 md:pt-12 overflow-hidden">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <motion.div style={{ y: statsY }} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 md:gap-8 pt-8 md:pt-12 border-t border-brand-black/10">
            <div className="text-center flex flex-col items-center"><span className="text-4xl md:text-6xl font-display font-light text-brand-black mb-2"><AnimatedCounter value={2015} start={2000} duration={2} /></span><span className="text-[9px] uppercase tracking-[0.3em] font-bold text-brand-secondary">Year Established</span></div>
            <div className="text-center flex flex-col items-center"><span className="text-4xl md:text-6xl font-display font-light text-brand-black mb-2"><AnimatedCounter value={500} suffix="+" duration={2.5} /></span><span className="text-[9px] uppercase tracking-[0.3em] font-bold text-brand-secondary">Employees</span></div>
            <div className="text-center flex flex-col items-center"><span className="text-4xl md:text-6xl font-display font-light text-brand-black mb-2"><AnimatedCounter value={26} suffix="+" duration={2} /></span><span className="text-[9px] uppercase tracking-[0.3em] font-bold text-brand-secondary">States Covered</span></div>
            <div className="text-center flex flex-col items-center"><span className="text-4xl md:text-6xl font-display font-light text-brand-black mb-2"><AnimatedCounter value={3} suffix="+" duration={1.5} /></span><span className="text-[9px] uppercase tracking-[0.3em] font-bold text-brand-secondary">Countries Reached</span></div>
            <div className="text-center flex flex-col items-center col-span-2 md:col-span-1 lg:col-span-1"><span className="text-4xl md:text-6xl font-display font-light text-brand-black mb-2"><AnimatedCounter value={700} suffix="+" duration={2.5} /></span><span className="text-[9px] uppercase tracking-[0.3em] font-bold text-brand-secondary">Partner</span></div>
          </motion.div>
        </div>
      </section>

      <section className="relative py-20 md:py-32 overflow-hidden bg-gradient-to-br from-[#1c1c1c] via-brand-black to-[#0a0a0a]">
        <div className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="max-w-2xl">
            <h2 className="text-4xl md:text-7xl font-display tracking-tight text-brand-white mb-6 md:mb-8 leading-[1.1]">Elevate Your <br /><span className="italic font-light text-brand-white/70">Retail Experience.</span></h2>
            <p className="text-sm md:text-lg text-brand-white/70 font-light leading-relaxed mb-8 md:mb-12 max-w-lg">Join our exclusive network of retail partners.</p>
          </div>
          <div className="bg-brand-white/5 backdrop-blur-md border border-brand-white/10 p-8 md:p-12">
            <h3 className="text-2xl font-display text-brand-white mb-8">Apply for Partnership</h3>
            <form onSubmit={handleWholesaleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <input required name="full_name" type="text" placeholder="Full Name" className="w-full bg-transparent border-b border-brand-white/20 pb-2 text-brand-white focus:border-brand-white focus:outline-none rounded-none" />
                <input required name="company_name" type="text" placeholder="Company Name" className="w-full bg-transparent border-b border-brand-white/20 pb-2 text-brand-white focus:border-brand-white focus:outline-none rounded-none" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <input required name="email" type="email" placeholder="Email" className="w-full bg-transparent border-b border-brand-white/20 pb-2 text-brand-white focus:border-brand-white focus:outline-none rounded-none" />
                <input required name="phone" type="tel" placeholder="Phone" className="w-full bg-transparent border-b border-brand-white/20 pb-2 text-brand-white focus:border-brand-white focus:outline-none rounded-none" />
              </div>
              <textarea required name="message" rows={3} placeholder="Message" className="w-full bg-transparent border-b border-brand-white/20 pb-2 text-brand-white focus:border-brand-white focus:outline-none resize-none rounded-none"></textarea>
              <input required name="image" type="file" accept="image/*" className="w-full bg-transparent border-b border-brand-white/20 pb-2 text-brand-white focus:border-brand-white focus:outline-none rounded-none file:mr-4 file:py-2 file:px-4 file:bg-brand-white file:text-brand-black cursor-pointer" />
              <button type="submit" disabled={wholesaleLoading} className="btn-primary w-full py-4 text-[10px] uppercase tracking-[0.3em] font-bold">
                {wholesaleLoading ? 'Submitting...' : 'Submit Application'}
              </button>
              {wholesaleSuccess && <p className="text-emerald-400 text-sm text-center mt-4">Application received successfully.</p>}
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}