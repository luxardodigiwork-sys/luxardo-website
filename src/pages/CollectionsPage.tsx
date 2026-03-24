import React from 'react';
import { SectionHeader } from '../components/SectionHeader';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { COLLECTIONS } from '../constants';

export default function CollectionsPage() {
  const collections = COLLECTIONS.map(col => ({
    title: col.fullName,
    path: `/collections/${col.id}`,
    img: col.image
  }));

  return (
    <div className="min-h-screen bg-brand-bg">
      <div className="section-padding">
        <SectionHeader title="All Collections" subtitle="Discover our range" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12 max-w-[1800px] mx-auto">
          {collections.map((col, i) => (
            <Link to={col.path} key={col.title} className={i === 6 ? "md:col-span-2 lg:col-span-1" : ""}>
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group cursor-pointer relative aspect-[4/5] overflow-hidden bg-brand-divider"
              >
                <img 
                  src={col.img} 
                  alt={col.title} 
                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105 grayscale-[20%]"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors duration-500" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <h3 className="text-3xl md:text-4xl font-display text-brand-white tracking-wide">{col.title}</h3>
                </div>
              </motion.div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
