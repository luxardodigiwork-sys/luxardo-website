import React from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Crown, Sparkles, Scissors, BookOpen, Headphones, Truck, ShieldCheck, ArrowRight, Check } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const BENEFITS = [
  { icon: Scissors,    title: "Bespoke Tailoring",         desc: "Made-to-measure construction with master tailors. Your exact silhouette, on every garment." },
  { icon: BookOpen,    title: "Private Fabric Library",    desc: "Access reserve fabrics imported from Italian and British mills, never offered to public." },
  { icon: Sparkles,    title: "Limited Editions First",    desc: "Exclusive drops and never-repeated pieces available to Prime members 7 days before launch." },
  { icon: Headphones,  title: "Dedicated Style Concierge", desc: "WhatsApp + video consultations with your personal style advisor. 7 days a week, 9 AM – 9 PM IST." },
  { icon: Truck,       title: "Priority Production",       desc: "Bespoke pieces ready in 14 days (vs 21 standard). Complimentary express delivery worldwide." },
  { icon: ShieldCheck, title: "Lifetime Alterations",      desc: "Free alterations and re-tailoring for every Prime piece, for as long as you own it." },
];

const COMPARISON = [
  { feature: "Ready-to-Stitch collections", direct: true, prime: true },
  { feature: "Standard sizing", direct: true, prime: true },
  { feature: "Free shipping (₹7,500+)", direct: true, prime: true },
  { feature: "7-day returns", direct: true, prime: true },
  { feature: "Bespoke measurements", direct: false, prime: true },
  { feature: "Private fabric library", direct: false, prime: true },
  { feature: "Early access to limited drops", direct: false, prime: true },
  { feature: "Dedicated style concierge", direct: false, prime: true },
  { feature: "Priority production (14 days)", direct: false, prime: true },
  { feature: "Lifetime alterations", direct: false, prime: true },
  { feature: "Complimentary worldwide express", direct: false, prime: true },
];

const FAQ = [
  { q: "How is Prime different from the standard collection?",
    a: "Standard offers ready-to-stitch luxury in stock sizing. Prime unlocks fully bespoke tailoring, private fabric reserves, and a dedicated concierge for every garment." },
  { q: "Is the membership annual?",
    a: "Yes. Prime is an annual membership renewable each year. We'll remind you 30 days before renewal — no surprise charges." },
  { q: "Can I cancel?",
    a: "Cancel any time. Benefits continue until the end of your billing year. No refunds on partial periods." },
  { q: "Do alterations include garments I bought before Prime?",
    a: "Lifetime alteration benefit applies to garments purchased while you are an active Prime member." },
  { q: "Where is the consultation conducted?",
    a: "WhatsApp video, in-person at our Bhilwara atelier (by appointment), or at private fittings in Mumbai/Delhi (curated dates)." },
];

export default function PrimePage() {
  const { user } = useAuth();
  const isPrime = !!user?.isPrimeMember;

  return (
    <div className="bg-brand-bg text-brand-black">
      {/* ─── Hero ─────────────────────────────────── */}
      <section className="relative min-h-[85vh] md:min-h-[100vh] bg-brand-black overflow-hidden flex items-center justify-center px-6">
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }} />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Crown size={500} className="text-white/[0.03]" strokeWidth={0.5} />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 max-w-3xl text-center text-white"
        >
          <div className="flex items-center gap-4 mb-8 justify-center">
            <span className="w-12 h-[1px] bg-white/60"></span>
            <span className="text-[11px] tracking-[0.5em] uppercase font-bold text-white/70">Members Only</span>
            <span className="w-12 h-[1px] bg-white/60"></span>
          </div>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-display font-light tracking-tight leading-[1.05] mb-8">
            LUXARDO Prime
          </h1>
          <p className="text-base md:text-xl text-white/75 font-light max-w-xl mx-auto leading-relaxed mb-12">
            The most exclusive tier of LUXARDO FASHION. Bespoke tailoring, private fabrics, and dedicated concierge — reserved for a limited number of members each year.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            {isPrime ? (
              <Link to="/prime-dashboard" className="inline-flex items-center gap-3 bg-white text-brand-black px-10 py-4 text-[11px] uppercase tracking-[0.3em] font-bold hover:bg-white/90 transition-colors">
                <Crown size={16} />
                Member Dashboard
              </Link>
            ) : (
              <>
                <Link to="/prime-membership/checkout" className="inline-flex items-center gap-3 bg-white text-brand-black px-10 py-4 text-[11px] uppercase tracking-[0.3em] font-bold hover:bg-white/90 transition-colors">
                  Become a Member
                  <ArrowRight size={14} />
                </Link>
                <a href="#benefits" className="inline-flex items-center gap-3 border border-white/40 text-white px-10 py-4 text-[11px] uppercase tracking-[0.3em] font-bold hover:border-white transition-colors">
                  Explore Benefits
                </a>
              </>
            )}
          </div>
        </motion.div>
      </section>

      {/* ─── Benefits Grid ────────────────────────── */}
      <section id="benefits" className="py-20 md:py-32 bg-brand-white px-6 md:px-16 lg:px-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 md:mb-20">
            <div className="inline-flex items-center gap-4 mb-6">
              <span className="w-8 h-[1px] bg-brand-black"></span>
              <span className="text-[10px] tracking-[0.4em] uppercase font-bold text-brand-secondary">The Privileges</span>
              <span className="w-8 h-[1px] bg-brand-black"></span>
            </div>
            <h2 className="text-3xl md:text-5xl font-display tracking-tight text-brand-black leading-tight">
              Six unique privileges,<br />reserved for Prime members.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-brand-divider">
            {BENEFITS.map((b, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="bg-white p-8 md:p-10 flex flex-col"
              >
                <div className="w-12 h-12 rounded-full bg-brand-black text-white flex items-center justify-center mb-6">
                  <b.icon size={20} />
                </div>
                <h3 className="font-display text-xl text-brand-black mb-3">{b.title}</h3>
                <p className="text-sm text-brand-secondary/80 font-light leading-relaxed">{b.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Comparison Table ─────────────────────── */}
      <section className="py-20 md:py-32 bg-brand-bg px-6 md:px-16 lg:px-24">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <div className="inline-flex items-center gap-4 mb-6">
              <span className="w-8 h-[1px] bg-brand-black"></span>
              <span className="text-[10px] tracking-[0.4em] uppercase font-bold text-brand-secondary">Direct vs Prime</span>
              <span className="w-8 h-[1px] bg-brand-black"></span>
            </div>
            <h2 className="text-3xl md:text-5xl font-display tracking-tight text-brand-black leading-tight">
              Choose your journey.
            </h2>
          </div>
          <div className="bg-white border border-brand-divider overflow-hidden">
            <div className="grid grid-cols-[1.5fr_1fr_1fr] border-b border-brand-divider bg-brand-bg/50">
              <div className="p-4 md:p-6 text-[10px] md:text-xs uppercase tracking-widest font-bold text-brand-secondary">Feature</div>
              <div className="p-4 md:p-6 text-[10px] md:text-xs uppercase tracking-widest font-bold text-brand-secondary text-center border-l border-brand-divider">Direct</div>
              <div className="p-4 md:p-6 text-[10px] md:text-xs uppercase tracking-widest font-bold text-white text-center bg-brand-black flex items-center justify-center gap-2">
                <Crown size={12} />Prime
              </div>
            </div>
            {COMPARISON.map((row, i) => (
              <div key={i} className={`grid grid-cols-[1.5fr_1fr_1fr] border-b border-brand-divider last:border-b-0 ${i % 2 === 0 ? 'bg-white' : 'bg-brand-bg/30'}`}>
                <div className="p-4 md:p-6 text-sm md:text-base text-brand-black font-light">{row.feature}</div>
                <div className="p-4 md:p-6 flex items-center justify-center border-l border-brand-divider">
                  {row.direct ? <Check size={18} className="text-brand-black/70" /> : <span className="text-brand-secondary/40">—</span>}
                </div>
                <div className="p-4 md:p-6 flex items-center justify-center bg-brand-black/[0.02]">
                  {row.prime ? <Check size={18} className="text-brand-black" /> : <span className="text-brand-secondary/40">—</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ──────────────────────────────── */}
      <section className="py-20 md:py-32 bg-brand-white px-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-4 mb-6">
              <span className="w-8 h-[1px] bg-brand-black"></span>
              <span className="text-[10px] tracking-[0.4em] uppercase font-bold text-brand-secondary">Membership</span>
              <span className="w-8 h-[1px] bg-brand-black"></span>
            </div>
            <h2 className="text-3xl md:text-5xl font-display tracking-tight text-brand-black leading-tight">The Annual Investment.</h2>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-brand-black text-white p-10 md:p-14 relative overflow-hidden"
          >
            <div className="absolute -top-12 -right-12 opacity-[0.05] pointer-events-none">
              <Crown size={200} strokeWidth={0.5} />
            </div>
            <div className="relative">
              <div className="flex items-center gap-3 mb-6">
                <Crown size={18} />
                <span className="text-[10px] tracking-[0.4em] uppercase font-bold text-white/70">Annual Membership</span>
              </div>
              <div className="flex items-baseline gap-3 mb-8">
                <span className="text-5xl md:text-7xl font-display font-light">₹ 49,999</span>
                <span className="text-sm text-white/60">/ year</span>
              </div>
              <p className="text-sm md:text-base text-white/75 font-light leading-relaxed mb-10 max-w-md">
                Inclusive of all six privileges. Renewable annually. Cancellable anytime. No hidden fees.
              </p>
              <Link to="/prime-membership/checkout" className="inline-flex items-center gap-3 bg-white text-brand-black px-10 py-4 text-[11px] uppercase tracking-[0.3em] font-bold hover:bg-white/90 transition-colors">
                Become a Member
                <ArrowRight size={14} />
              </Link>
              <p className="text-[10px] tracking-widest uppercase text-white/40 mt-6">
                Limited memberships per year • Application reviewed
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── FAQ ──────────────────────────────────── */}
      <section className="py-20 md:py-32 bg-brand-bg px-6 md:px-16 lg:px-24">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-4 mb-6">
              <span className="w-8 h-[1px] bg-brand-black"></span>
              <span className="text-[10px] tracking-[0.4em] uppercase font-bold text-brand-secondary">Questions</span>
              <span className="w-8 h-[1px] bg-brand-black"></span>
            </div>
            <h2 className="text-3xl md:text-5xl font-display tracking-tight text-brand-black leading-tight">Frequently asked.</h2>
          </div>
          <div className="space-y-px bg-brand-divider">
            {FAQ.map((item, i) => (
              <details key={i} className="bg-white p-6 md:p-8 group cursor-pointer">
                <summary className="flex items-center justify-between list-none">
                  <span className="font-display text-base md:text-lg text-brand-black flex-1 pr-4">{item.q}</span>
                  <span className="w-8 h-8 rounded-full border border-brand-divider flex items-center justify-center text-brand-black transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="text-sm md:text-base text-brand-secondary/80 font-light leading-relaxed mt-4 pr-12">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ────────────────────────────── */}
      <section className="py-24 md:py-40 bg-brand-black text-white text-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="max-w-3xl mx-auto"
        >
          <Crown size={40} className="mx-auto mb-8 opacity-60" />
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-display tracking-tight leading-[1.1] mb-8">
            "True luxury is not what you buy.<br />It is what is built for you."
          </h2>
          <div className="w-12 h-[1px] bg-white/40 mx-auto mb-8"></div>
          <p className="text-sm md:text-base text-white/70 mb-12 max-w-xl mx-auto leading-relaxed">
            Join LUXARDO Prime — the most personal expression of our craft.
          </p>
          <Link
            to={isPrime ? "/prime-dashboard" : "/prime-membership/checkout"}
            className="inline-flex items-center gap-3 bg-white text-brand-black px-12 py-4 text-[11px] uppercase tracking-[0.3em] font-bold hover:bg-white/90 transition-colors"
          >
            {isPrime ? "Member Dashboard" : "Begin Application"}
            <ArrowRight size={14} />
          </Link>
        </motion.div>
      </section>
    </div>
  );
}
