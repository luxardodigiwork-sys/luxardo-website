import React, { useState } from 'react';
import { useOutletContext, Link, useParams } from 'react-router-dom';
import { Country } from '../types';
import { storage } from '../utils/localStorage';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronDown, 
  ChevronUp, 
  Heart, 
  Check, 
  Package, 
  Scissors, 
  ShieldCheck, 
  HelpCircle, 
  ArrowRight,
  Info
} from 'lucide-react';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { formatINR } from '../utils/currency';

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const { selectedCountry } = useOutletContext<{ selectedCountry: Country | null }>();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const { addToCart } = useCart();
  
  const products = storage.getProducts();
  const product = products.find(p => p.id === id) || products[0];
  const isPrimeMember = false; // Mock state

  const [openSection, setOpenSection] = useState<string | null>('details');
  const [isAdding, setIsAdding] = useState(false);

  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  const isWishlisted = isInWishlist(product.id);

  const handleWishlistToggle = () => {
    if (isWishlisted) {
      removeFromWishlist(product.id);
    } else {
      addToWishlist(product);
    }
  };

  const handleAddToCart = () => {
    setIsAdding(true);
    addToCart(product);
    setTimeout(() => setIsAdding(false), 1000);
  };

  // Gallery images - using main image and some high-quality placeholders for detail
  const galleryImages = [
    product.image,
    "https://images.unsplash.com/photo-1598532163257-ae3c6b2524b6?q=80&w=1000&auto=format&fit=crop", // Detail
    "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?q=80&w=1000&auto=format&fit=crop", // Fabric
    "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?q=80&w=1000&auto=format&fit=crop"  // Packaging/Context
  ];

  return (
    <div className="bg-brand-bg min-h-screen">
      <div className="section-padding max-w-[1800px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24">
          
          {/* 1. Large premium image gallery on the left (7 cols) */}
          <div className="lg:col-span-7 space-y-8">
            <div className="aspect-[3/4] overflow-hidden bg-brand-divider">
              <img 
                src={galleryImages[0]} 
                alt={product.name} 
                className="w-full h-full object-cover grayscale-[10%] hover:scale-105 transition-transform duration-1000"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="grid grid-cols-2 gap-8">
              {galleryImages.slice(1).map((img, idx) => (
                <div key={idx} className="aspect-[3/4] overflow-hidden bg-brand-divider">
                  <img 
                    src={img} 
                    alt={`${product.name} detail ${idx + 1}`} 
                    className="w-full h-full object-cover grayscale-[10%] hover:scale-105 transition-transform duration-1000"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ))}
            </div>
          </div>
          
          {/* 2. Product information on the right (5 cols) */}
          <div className="lg:col-span-5">
            <div className="sticky top-32 space-y-12">
              {/* Header */}
              <div className="space-y-6">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] font-bold text-brand-secondary mb-4">{product.category}</p>
                  <h1 className="text-5xl md:text-6xl font-display leading-tight">{product.name}</h1>
                </div>
                <p className="text-2xl font-sans text-brand-black">
                  {formatINR(product.price)}
                </p>
                <p className="text-lg font-sans text-brand-secondary leading-relaxed max-w-xl">
                  {product.description}
                </p>
              </div>

              {/* Garment Format */}
              <div className="space-y-8">
                <div className="space-y-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-brand-black">Garment Format</p>
                  <div className="p-5 border border-brand-black bg-brand-white flex items-center justify-between">
                    <span className="text-sm font-sans text-brand-black">Ready-to-Stitch Presentation Box</span>
                    <Package size={18} className="text-brand-black" />
                  </div>
                </div>

                <div className="flex gap-4 p-6 bg-brand-white border border-brand-divider italic">
                  <Info size={20} className="text-brand-secondary shrink-0 mt-0.5" />
                  <p className="text-sm font-sans text-brand-secondary leading-relaxed">
                    Standard orders include a ready-to-stitch boxed garment with stitch style guidance. Stitching is not included.
                  </p>
                </div>
              </div>

              {/* 3. Primary CTA & 4. Secondary CTA */}
              <div className="space-y-6">
                <div className="flex gap-4">
                  <button 
                    onClick={handleAddToCart}
                    disabled={isAdding}
                    className="btn-primary flex-1 py-5 disabled:opacity-50"
                  >
                    {isAdding ? 'ADDING...' : 'ADD TO CART'}
                  </button>
                  <button 
                    onClick={handleWishlistToggle}
                    className={`p-5 border border-brand-black transition-colors flex items-center justify-center ${isWishlisted ? 'bg-brand-black text-brand-white' : 'hover:bg-brand-black hover:text-brand-white'}`}
                  >
                    <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-current' : ''}`} />
                  </button>
                </div>
                
                <div className="text-center">
                  <Link to="/prime-membership" className="text-[11px] uppercase tracking-[0.2em] font-bold text-brand-secondary hover:text-brand-black transition-colors inline-flex items-center gap-2">
                    Explore Prime Member Benefits <ArrowRight size={14} />
                  </Link>
                </div>
              </div>

              {/* 5. Trust Bullets */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12 pt-8 border-t border-brand-divider">
                {[
                  { icon: <Package size={16} />, text: 'Premium presentation packaging included' },
                  { icon: <Scissors size={16} />, text: 'Stitch style guidance included' },
                  { icon: <ShieldCheck size={16} />, text: 'Carefully selected imported fabric' },
                  { icon: <HelpCircle size={16} />, text: 'Concierge support available' }
                ].map((bullet, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <span className="text-brand-black">{bullet.icon}</span>
                    <span className="text-[11px] uppercase tracking-widest font-bold text-brand-secondary">{bullet.text}</span>
                  </div>
                ))}
              </div>

              {/* 6. What's Included */}
              <div className="bg-brand-white p-8 border border-brand-divider space-y-6">
                <h4 className="text-[11px] uppercase tracking-[0.2em] font-bold text-brand-black border-b border-brand-divider pb-4">What's Included</h4>
                <ul className="space-y-4">
                  {[
                    'Ready-to-stitch garment fabric set',
                    'Stitch style reference card',
                    'Care instructions',
                    'Premium Luxardo presentation packaging'
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-4 text-sm font-sans text-brand-secondary">
                      <Check size={14} className="text-brand-black" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* 7. Detail Sections / Accordions */}
              <div className="border-t border-brand-divider">
                {[
                  { id: 'details', title: 'Product Description', content: product.description + ' Designed for the modern gentleman who values heritage and precision.' },
                  { id: 'fabric', title: 'Fabric & Finish', content: 'Selected imported fabrics chosen for structure and ethnic elegance. Features a refined finish that holds its shape while providing exceptional comfort.' },
                  { id: 'packaging', title: 'Packaging', content: 'Every order arrives in our signature presentation box, featuring acid-free archival tissue and a hand-pressed wax seal.' },
                  { id: 'shipping', title: 'Shipping', content: 'Standard orders are processed within 3-5 business days. Prime Members receive priority processing. International shipping available via DHL/FedEx.' },
                  { id: 'returns', title: 'Returns', content: 'Standard ready-to-stitch garments can be returned within 14 days in original condition. Bespoke services and Prime Member fees are non-returnable.' },
                  { id: 'care', title: 'Care Instructions', content: 'Dry clean only. Iron on low heat. Do not bleach. Handle with care to preserve artisan character and fabric integrity.' }
                ].map((section) => (
                  <div key={section.id} className="border-b border-brand-divider">
                    <button 
                      onClick={() => toggleSection(section.id)}
                      className="w-full py-6 flex justify-between items-center text-left hover:text-brand-secondary transition-colors"
                    >
                      <span className="text-[11px] uppercase tracking-[0.25em] font-bold">{section.title}</span>
                      {openSection === section.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <AnimatePresence>
                      {openSection === section.id && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <p className="pb-6 font-sans text-brand-secondary text-sm leading-relaxed">
                            {section.content}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>

              {/* 8. Premium Reassurance Statement */}
              <div className="pt-12 text-center">
                <p className="text-xl font-display italic text-brand-secondary leading-relaxed">
                  "Designed for men who value structure, refinement, and presentation over mass-made fashion."
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 9. Related Products Section */}
        <div className="mt-48 border-t border-brand-divider pt-24">
          <div className="text-center space-y-4 mb-16">
            <p className="text-[11px] uppercase tracking-[0.3em] font-bold text-brand-secondary">Curated For You</p>
            <h3 className="text-4xl font-display">You May Also Like</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
            {products.filter(p => p.id !== product.id).slice(0, 4).map(relatedProduct => (
              <Link to={`/product/${relatedProduct.id}`} key={relatedProduct.id} className="group cursor-pointer">
                <div className="aspect-[3/4] overflow-hidden bg-brand-divider mb-6">
                  <img 
                    src={relatedProduct.image} 
                    alt={relatedProduct.name} 
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105 grayscale-[10%]"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-brand-secondary">{relatedProduct.category}</p>
                  <h4 className="text-xl font-display">{relatedProduct.name}</h4>
                  <p className="font-sans text-brand-secondary">
                    {formatINR(relatedProduct.price)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* 10. Lower-page Prime Member teaser block */}
        <div className="mt-48 bg-brand-black text-brand-white p-16 md:p-24 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1556905055-8f358a7a47b2?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center grayscale" />
          <div className="relative z-10 max-w-3xl mx-auto space-y-10">
            <h3 className="text-4xl md:text-5xl font-display">Looking for a more personal experience?</h3>
            <p className="text-xl font-sans text-brand-white/70 leading-relaxed">
              Prime Members receive access to private consultation, selected fabric access, and bespoke services.
            </p>
            <Link to="/prime-membership" className="btn-secondary inline-block px-12 py-5">
              EXPLORE PRIME MEMBER BENEFITS
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
