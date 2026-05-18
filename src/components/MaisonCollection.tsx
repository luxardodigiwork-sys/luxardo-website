import React from "react";
import { ArrowRight } from "lucide-react";

const COLLECTIONS = [
  {
    id: "3-piece-suit",
    title: "The 3-Piece Suit",
    tagline: "Supercharged by Architecture.",
    description: "Constructed with clean structural lines, sharp European silhouettes, and immaculate fabric depth.",
    image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=1800&q=80",
    link: "/collections/suits",
    darkTheme: true
  },
  {
    id: "tuxedo",
    title: "The Tuxedo",
    tagline: "Elegance. Light years ahead.",
    description: "The definitive evening silhouette. Crafted from the finest midnight fibers with clean satin peak lapels.",
    image: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1800&q=80",
    link: "/collections/tuxedos",
    darkTheme: false
  },
  {
    id: "jodhpuri",
    title: "The Jodhpuri",
    tagline: "Heritage. Remastered.",
    description: "Where core Bhilwara textile legacy meets pristine modern luxury with intricate master artisan embroidery.",
    image: "https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&w=1800&q=80",
    link: "/collections/jodhpuri",
    darkTheme: true
  }
];

export default function MaisonCollection() {
  return (
    <div className="bg-white w-full select-none">
      <div className="flex flex-col w-full">
        {COLLECTIONS.map((item) => (
          /* Each product gets a massive sticky tracking window */
          <div key={item.id} className="relative w-full h-[130vh] bg-transparent">
            
            {/* Pinned Full Screen Viewport Frame */}
            <div className={`sticky top-0 w-full h-screen flex flex-col items-center justify-start text-center pt-24 px-4 overflow-hidden ${
              item.darkTheme ? "bg-black text-white" : "bg-[#f5f5f7] text-neutral-900"
            }`}>
              
              {/* Apple-Style Text Header Layer */}
              <div className="z-10 max-w-3xl space-y-3 px-4 drop-shadow-sm">
                <h2 className="text-4xl md:text-7xl font-semibold tracking-tight uppercase">
                  {item.title}
                </h2>
                <p className={`text-xl md:text-2xl font-normal tracking-wide ${
                  item.darkTheme ? "text-neutral-300" : "text-neutral-600"
                }`}>
                  {item.tagline}
                </p>
                <p className="text-xs md:text-sm max-w-md mx-auto opacity-75 font-light leading-relaxed">
                  {item.description}
                </p>
                
                {/* Apple Blue Pill Call-to-Actions */}
                <div className="flex items-center justify-center gap-6 pt-3">
                  <a href={item.link} className="bg-[#0071e3] text-white hover:bg-[#0077ed] transition-all text-xs md:text-sm font-normal px-5 py-2.5 rounded-full tracking-wide shadow-sm">
                    Discover
                  </a>
                  <a href="/contact" className="text-[#0066cc] hover:underline text-xs md:text-sm font-normal flex items-center gap-1 group">
                    Bespoke Order <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                  </a>
                </div>
              </div>

              {/* Massive Full-Bleed Background Image Channel */}
              <div className="absolute inset-0 w-full h-full z-0 pointer-events-none">
                <img 
                  src={item.image} 
                  alt={item.title}
                  className="w-full h-full object-cover object-center transition-transform duration-1000 ease-out"
                  style={{ opacity: item.darkTheme ? "0.45" : "0.9" }}
                />
                {/* Smooth cinematic ambient overlay */}
                <div className={`absolute inset-0 ${
                  item.darkTheme 
                    ? "bg-gradient-to-b from-black/60 via-transparent to-black/30" 
                    : "bg-gradient-to-b from-white/10 via-transparent to-transparent"
                }`} />
              </div>

            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
