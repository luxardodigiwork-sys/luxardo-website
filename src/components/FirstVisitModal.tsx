import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Check, MapPin } from 'lucide-react';
import Logo from './Logo';
import { Country } from '../types';
import { SUPPORTED_COUNTRIES, DEFAULT_COUNTRY_CODE } from '../countries';
import { detectCountryCode, isSupportedCountryCode } from '../utils/detectCountry';

interface FirstVisitModalProps {
  onSelect: (country: Country) => void;
}

export const FirstVisitModal: React.FC<FirstVisitModalProps> = ({ onSelect }) => {
  const [detecting, setDetecting] = useState(true);
  const [detectedCode, setDetectedCode] = useState<string | null>(null);
  const [selectedCode, setSelectedCode] = useState<string>(DEFAULT_COUNTRY_CODE);
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    let active = true;
    detectCountryCode().then(code => {
      if (!active) return;
      setDetectedCode(code);
      if (isSupportedCountryCode(code)) setSelectedCode(code as string);
      setDetecting(false);
    });
    return () => { active = false; };
  }, []);

  const selected = SUPPORTED_COUNTRIES.find(c => c.code === selectedCode) || SUPPORTED_COUNTRIES[0];
  const detectedSupported = isSupportedCountryCode(detectedCode) && detectedCode === selectedCode;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, pointerEvents: 'auto' }}
      exit={{ opacity: 0, pointerEvents: 'none' }}
      className="fixed inset-0 z-[100] bg-brand-bg flex items-center justify-center p-4 md:p-8 pointer-events-auto"
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1.2, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-xl bg-brand-white p-8 md:p-16 flex flex-col items-center text-center shadow-sm border border-brand-divider max-h-[90vh] overflow-y-auto"
      >
        <div className="mb-8 shrink-0">
          <Logo className="h-16 md:h-20 w-auto" />
        </div>

        <h2 className="text-2xl md:text-3xl font-display mb-3 tracking-tight shrink-0">
          {changing ? 'Select Your Country' : 'Confirm Your Country'}
        </h2>

        {!changing && (
          <div className="w-full mb-8">
            <p className="text-sm font-sans text-brand-secondary mb-6">
              {detecting
                ? 'Detecting your location...'
                : detectedSupported
                  ? 'Based on your location, we will show prices and shipping for:'
                  : 'We could not match your location automatically. Showing:'}
            </p>
            <div className="flex items-center justify-center gap-3 border border-brand-divider py-5 px-6">
              <MapPin className="w-5 h-5 text-brand-secondary" />
              <span className="text-lg font-display tracking-wide">{detecting ? '...' : selected.name}</span>
              {!detecting && (
                <span className="text-xs font-sans text-brand-secondary tracking-widest">
                  ({selected.currency.code})
                </span>
              )}
            </div>
          </div>
        )}

        {changing && (
          <div
            className="w-full mb-8 border border-brand-divider bg-brand-white text-left"
            role="listbox"
            aria-label="Countries"
          >
            {SUPPORTED_COUNTRIES.map(country => (
              <button
                key={country.code}
                onClick={() => setSelectedCode(country.code)}
                role="option"
                aria-selected={selectedCode === country.code}
                className={`w-full px-6 py-4 text-sm font-sans tracking-[0.1em] text-left hover:bg-brand-bg transition-colors flex justify-between items-center focus:outline-none focus:bg-brand-bg ${
                  selectedCode === country.code ? 'bg-brand-bg font-bold' : ''
                }`}
              >
                <span>{country.name}</span>
                {selectedCode === country.code && <Check className="w-4 h-4" />}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => onSelect(selected)}
          disabled={detecting}
          className={`btn-primary w-full py-5 text-[11px] uppercase tracking-[0.25em] font-bold transition-all duration-300 shrink-0 pointer-events-auto rounded-full ${
            detecting ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          {changing ? 'Continue' : 'Confirm'}
        </button>

        <button
          onClick={() => setChanging(c => !c)}
          className="mt-5 text-[11px] uppercase tracking-[0.2em] font-sans text-brand-secondary underline underline-offset-4 hover:text-brand-black transition-colors"
        >
          {changing ? 'Back' : 'Change country'}
        </button>
      </motion.div>
    </motion.div>
  );
};
