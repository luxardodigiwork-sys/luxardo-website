import React from 'react';
import { motion } from 'motion/react';
import { SectionHeader } from './SectionHeader';

const processSteps = [
  {
    title: 'Imported Fabric Selection',
    text: 'Every LUXARDO FASHION garment begins with carefully selected imported fabrics chosen for texture, durability, and refined appearance.',
    img: '/placeholder.svg',
  },
  {
    title: 'Design Development',
    text: 'Our design studio develops modern ethnic silhouettes that balance tradition and contemporary structure.',
    img: '/placeholder.svg',
  },
  {
    title: 'Expert Refinement',
    text: 'Designs are meticulously refined to ensure the perfect fit and aesthetic balance before moving to production.',
    img: '/placeholder.svg',
  },
  {
    title: 'Production Execution',
    text: 'Experienced production teams translate refined designs into structured garments with disciplined tailoring techniques.',
    img: '/placeholder.svg',
  },
  {
    title: 'Finishing Inspection',
    text: 'Every garment passes through careful inspection to ensure finishing standards meet LUXARDO FASHION expectations.',
    img: '/placeholder.svg',
  },
  {
    title: 'Presentation Packaging',
    text: 'Each piece is carefully packed in our signature presentation box, reflecting our commitment to luxury at every touchpoint.',
    img: '/placeholder.svg',
  },
  {
    title: 'Final Dispatch Check',
    text: 'A final verification ensures every detail is perfect before the garment is dispatched to its new home.',
    img: '/placeholder.svg',
  }
];

export const LuxardoProcess: React.FC = () => {
  return (
    <section className="section-padding bg-brand-white">
      <SectionHeader 
        title="The LUXARDO FASHION Process" 
        subtitle="From fabric selection to final presentation, every LUXARDO FASHION garment follows a refined process designed to maintain quality, structure, and modern ethnic elegance." 
      />
      
      <div className="max-w-[1400px] mx-auto space-y-32 md:space-y-48 mt-24">
        {processSteps.map((step, index) => {
          const isEven = index % 2 !== 0; // 0-indexed, so 1, 3, 5 are "even" blocks (Text Left, Image Right)
          
          return (
            <div 
              key={step.title} 
              className={`flex flex-col ${isEven ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-12 md:gap-24`}
            >
              {/* Image Block */}
              <motion.div 
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                className="w-full md:w-1/2"
              >
                <div className="aspect-[4/5] overflow-hidden bg-brand-divider relative group">
                  <img 
                    src={step.img} 
                    alt={step.title} 
                    className="w-full h-full object-cover -[20%] transition-transform duration-[2s] ease-out group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </motion.div>

              {/* Text Block */}
              <motion.div 
                initial={{ opacity: 0, x: isEven ? -40 : 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 1.2, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="w-full md:w-1/2 space-y-6 text-center md:text-left"
              >
                <p className="text-[11px] uppercase tracking-[0.25em] font-bold text-brand-secondary">
                  Step 0{index + 1}
                </p>
                <h3 className="text-4xl md:text-5xl font-display text-brand-black">
                  {step.title}
                </h3>
                <p className="text-lg md:text-xl font-sans text-brand-secondary leading-relaxed max-w-md mx-auto md:mx-0">
                  {step.text}
                </p>
              </motion.div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
