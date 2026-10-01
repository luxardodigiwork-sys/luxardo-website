import React from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Product } from '../types';
import { Heart } from 'lucide-react';
import { useWishlist } from '../context/WishlistContext';
import { formatCurrency } from '../utils/currency';

const isMissingImage = (src?: string) =>
  !src || src === '/placeholder.svg' || src.endsWith('placeholder.svg');

export const ProductCard: React.FC<{ product: Product }> = ({ product }) => {
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist();
  const isWishlisted = isInWishlist(product.id);
  const mainImage = product.image;
  const secondaryImage = product.images && product.images.length > 1 ? product.images[1] : null;
  const hasImage = !isMissingImage(mainImage);

  const toggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isWishlisted) {
      removeFromWishlist(product.id);
    } else {
      addToWishlist(product);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="group relative flex flex-col"
    >
      <div className="aspect-[3/4] overflow-hidden bg-brand-bg relative">
        <Link to={`/product/${product.id}`} className="block w-full h-full relative overflow-hidden">
          {hasImage ? (
            <>
              <img
                src={mainImage}
                alt={product.name}
                loading="lazy"
                className={`absolute inset-0 w-full h-full object-cover transition-all duration-[1200ms] ease-out ${
                  secondaryImage ? 'group-hover:opacity-0' : 'group-hover:scale-[1.04]'
                }`}
                referrerPolicy="no-referrer"
              />
              {secondaryImage && !isMissingImage(secondaryImage) && (
                <img
                  src={secondaryImage}
                  alt={`${product.name} alternate view`}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-[1200ms] ease-out"
                  referrerPolicy="no-referrer"
                />
              )}
            </>
          ) : (
            // Image-less luxury placeholder card
            <div className="absolute inset-0 bg-gradient-to-br from-[#f3eee3] via-[#e8e0cd] to-[#d6cab0] flex flex-col items-center justify-center p-6 text-center">
              <div className="text-[10px] uppercase tracking-[0.4em] text-brand-black/40 mb-3">LUXARDO</div>
              <div className="font-display text-2xl text-brand-black/60 leading-tight">
                {product.name}
              </div>
              <div className="text-[9px] uppercase tracking-[0.3em] text-brand-black/30 mt-4">Image coming soon</div>
            </div>
          )}
        </Link>

        <button
          onClick={toggleWishlist}
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          className="absolute top-3 right-3 w-10 h-10 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-full transition-all hover:scale-110 hover:bg-white shadow-sm z-10"
        >
          <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-brand-black text-brand-black' : 'text-brand-black stroke-[1.5]'}`} />
        </button>

        {/* Subtle category tag (top-left) when category present */}
        {product.category && (
          <div className="absolute top-3 left-3 bg-brand-bg/85 backdrop-blur-sm px-2.5 py-1 text-[9px] uppercase tracking-[0.25em] font-bold text-brand-black/70">
            {product.category.replace('Premium ', '')}
          </div>
        )}
      </div>

      <Link to={`/product/${product.id}`} className="mt-4 flex flex-col gap-1.5 text-left">
        <h3 className="font-display text-base md:text-lg text-brand-black leading-tight line-clamp-2">
          {product.name}
        </h3>
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] uppercase tracking-[0.25em] text-brand-secondary">MRP</span>
          <span className="text-sm md:text-base font-sans text-brand-black tracking-wide">
            {formatCurrency(product.price)}
          </span>
        </div>
      </Link>
    </motion.div>
  );
};
