import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Logo } from './Logo';
import { Country } from '../types';
import { ALL_COUNTRIES } from '../countries';

interface FirstVisitModalProps {
  onSelect: (country: Country) => void;
}

export const FirstVisitModal: React.FC<FirstVisitModalProps> = ({ onSelect }) => {
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>('');

  const handleContinue = () => {
    const country = ALL_COUNTRIES.find(c => c.code === selectedCountryCode);
    if (country) {
      onSelect(country);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-brand-bg flex items-center justify-center p-4 md:p-8"
      >
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="w-full max-w-xl bg-brand-white p-8 md:p-16 flex flex-col items-center text-center shadow-sm border border-brand-divider"
        >
          <div className="mb-12">
            <Logo className="h-16 md:h-20 w-auto" />
          </div>

          <h2 className="text-2xl md:text-3xl font-display mb-10 tracking-tight">Select Your Country</h2>

          <div className="w-full space-y-3 mb-12 relative">
            <select
              value={selectedCountryCode}
              onChange={(e) => setSelectedCountryCode(e.target.value)}
              className="w-full py-4 px-6 text-sm font-sans tracking-[0.1em] border border-brand-divider focus:border-brand-black outline-none appearance-none bg-transparent cursor-pointer transition-colors"
            >
              <option value="" disabled>Select a country...</option>
              {ALL_COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
            <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>

          <button
            onClick={handleContinue}
            disabled={!selectedCountryCode}
            className={`w-full py-5 text-[11px] uppercase tracking-[0.25em] font-bold transition-all duration-500 ${
              selectedCountryCode
                ? 'bg-brand-black text-brand-white hover:bg-brand-hover'
                : 'bg-brand-divider text-brand-secondary cursor-not-allowed'
            }`}
          >
            Continue
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
