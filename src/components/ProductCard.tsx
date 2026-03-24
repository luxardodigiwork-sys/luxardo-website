import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Product } from '../types';
import { Heart } from 'lucide-react';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { formatINR } from '../utils/currency';

export const ProductCard: React.FC<{ product: Product }> = ({ product }) => {
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist();
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);
  const isWishlisted = isInWishlist(product.id);

  const toggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isWishlisted) {
      removeFromWishlist(product.id);
    } else {
      addToWishlist(product);
    }
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="group relative"
    >
      <div className="aspect-[3/4] overflow-hidden bg-[#F5F5F5] mb-8 relative">
        <Link to={`/product/${product.id}`} className="block w-full h-full">
          <img 
            src={product.image} 
            alt={product.name} 
            className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105 grayscale-[20%]"
            referrerPolicy="no-referrer"
          />
        </Link>
        
        <button 
          onClick={toggleWishlist}
          className="absolute top-4 right-4 p-2 bg-brand-white/80 backdrop-blur-sm rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-brand-white z-10"
        >
          <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-brand-black text-brand-black' : 'text-brand-secondary'}`} />
        </button>
        
        <div className="absolute inset-x-0 bottom-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-500 z-10">
          <button 
            onClick={handleAddToCart}
            className={`w-full py-4 ${added ? 'bg-emerald-900' : 'bg-brand-black'} text-brand-white text-[12px] uppercase tracking-[0.2em] font-bold transition-colors duration-300`}
          >
            {added ? 'Added to Bag' : 'Add to Cart'}
          </button>
        </div>
      </div>

      <Link to={`/product/${product.id}`} className="space-y-3 text-center block">
        <h3 className="text-2xl font-display">{product.name}</h3>
        <p className="text-base font-sans text-brand-secondary">{formatINR(product.price)}</p>
      </Link>
    </motion.div>
  );
};
