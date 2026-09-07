import React, { useState, useMemo, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ProductCard } from '../components/ProductCard';
import { useProducts } from '../context/ProductsContext';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';

export default function CollectionsPage() {
  const { products: allProducts } = useProducts();
  const { category: urlCategorySlug } = useParams(); // Get SLUG from URL (e.g., /collections/3-piece-suit)
  const [searchQuery, setSearchQuery] = useState('');
  const [conditionFilter, setConditionFilter] = useState<'All' | 'Newly' | 'Regular' | 'Limited Edition'>('All');
  
  // 🚀 Fetch Live Categories from Database
  const [dbCategories, setDbCategories] = useState<any[]>([]);
  
  useEffect(() => {
    const fetchCats = async () => {
      const snap = await getDocs(collection(db, 'categories'));
      if (!snap.empty) {
        const cats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        cats.sort((a: any, b: any) => a.sortOrder - b.sortOrder);
        setDbCategories(cats);
      }
    };
    fetchCats();
  }, []);

  // Set the selected category based on the URL Slug
  const [selectedCategory, setSelectedCategory] = useState<string | null>(urlCategorySlug || null);

  useEffect(() => {
    if (urlCategorySlug) {
      setSelectedCategory(urlCategorySlug);
    } else {
      setSelectedCategory(null);
    }
  }, [urlCategorySlug]);

  const filteredProducts = useMemo(() => {
    let result = [...allProducts];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query)
      );
    }

    if (conditionFilter === 'Newly') {
      result = [...result].reverse().slice(0, Math.ceil(result.length * 0.7));
    } else if (conditionFilter === 'Limited Edition') {
      result = result.filter(p => (p.price && p.price > 150000) || p.name.toLowerCase().includes('limited'));
    } else if (conditionFilter === 'Regular') {
      result = result.filter(p => !p.name.toLowerCase().includes('limited') && (!p.price || p.price <= 150000));
    }

    // 🚀 FILTER MATCHING FIX: Check if Product Category matches Category SLUG or ID
    if (selectedCategory && dbCategories.length > 0) {
      // Find the actual category object
      const matchedCat = dbCategories.find(c => c.slug === selectedCategory || c.id === selectedCategory);
      if (matchedCat) {
        // If your AdminProduct upload saves category as the ID or Slug, match it here
        result = result.filter(p => p.category === matchedCat.id || p.category === matchedCat.slug || p.category === matchedCat.name);
      } else {
        // Fallback for custom names
        result = result.filter(p => p.category.toLowerCase().replace(/\s+/g, '-') === selectedCategory.toLowerCase());
      }
    }

    return result;
  }, [allProducts, searchQuery, conditionFilter, selectedCategory, dbCategories]);

  return (
    <div className="min-h-screen bg-brand-bg pb-32">
      <div className="pt-24 pb-12 md:pt-32 md:pb-16 px-4 md:px-12 max-w-[1800px] mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} className="space-y-2 md:space-y-4">
          <span className="text-[9px] md:text-[10px] uppercase tracking-[0.3em] md:tracking-[0.4em] font-bold text-brand-secondary">The Archive</span>
          <h1 className="text-4xl md:text-7xl lg:text-8xl font-display tracking-tight text-brand-black">COLLECTIONS</h1>
        </motion.div>
      </div>

      <div className="sticky top-[73px] z-40 bg-white/60 backdrop-blur-2xl backdrop-saturate-[1.5] border-b border-gray-200 py-3 px-4 md:px-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-[11px] font-sans uppercase tracking-widest text-black">
          
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto scrollbar-hide py-1">
            {['All', 'Newly', 'Regular', 'Limited Edition'].map(condition => (
              <button key={condition} onClick={() => setConditionFilter(condition as any)} className={`flex-shrink-0 !py-2 !px-6 ${conditionFilter === condition ? 'btn-primary' : 'btn-outline !text-brand-secondary'}`}>
                {condition}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4 overflow-x-auto w-full md:w-auto scrollbar-hide py-1">
            <span className="text-gray-400">Filter By:</span>
            <button onClick={() => setSelectedCategory(null)} className={`${!selectedCategory ? 'font-bold border-b border-black' : 'text-gray-500'} pb-1`}>All</button>
            
            {/* Show Live Categories from Database */}
            {dbCategories.map((cat) => (
              <button 
                key={cat.id} 
                onClick={() => setSelectedCategory(cat.slug)} 
                className={`${selectedCategory === cat.slug ? 'font-bold border-b border-black' : 'text-gray-500'} pb-1 whitespace-nowrap`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-8 shrink-0 py-2">
            <span className="font-bold text-brand-secondary">{filteredProducts.length} Products</span>
          </div>
        </div>
      </div>

      <div className="w-full bg-transparent">
        <AnimatePresence mode="wait">
          <motion.div key={selectedCategory || conditionFilter} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-0">
                {filteredProducts.map((product) => (
                  <div key={product.id} className="border-r border-b border-transparent hover:border-gray-100 transition-colors">
                    <ProductCard product={product} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-48 text-center bg-white">
                <p className="text-xl font-sans uppercase tracking-widest text-gray-500 mb-8">No pieces found in this collection.</p>
                <button className="text-[11px] uppercase tracking-widest border-b border-black pb-1" onClick={() => { setSearchQuery(''); setSelectedCategory(null); }}>
                  View All Collections
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}