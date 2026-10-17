import React, { createContext, useContext, useState } from 'react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Country } from '../types';
import { INDIA_COUNTRY } from '../utils/launchMarket';

interface CountryContextType {
  selectedCountry: Country | null;
  setCountry: (country: Country) => void;
  showModal: boolean;
  dismissModal: () => void;
}

const CountryContext = createContext<CountryContextType | null>(null);

const STORAGE_KEY = 'LUXARDO FASHION_country_code';

export function CountryProvider({ children }: { children: React.ReactNode }) {
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(INDIA_COUNTRY);
  // No region prompt during the India launch; stored global preferences are left untouched.
  const showModal = false;

  const setCountry = async (country: Country) => {
    if (country.code !== 'IN') return;
    setSelectedCountry(country);
    try {
      localStorage.setItem(STORAGE_KEY, country.code);
      const sessionId = localStorage.getItem('LUXARDO FASHION_session_id') || crypto.randomUUID();
      localStorage.setItem('LUXARDO FASHION_session_id', sessionId);
      await setDoc(doc(db, 'sessions', sessionId), {
        country: country.code,
        currency: country.currency.code,
        language: country.language,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (e) { console.error('Country save error:', e); }
  };

  const dismissModal = () => {};

  return (
    <CountryContext.Provider value={{ selectedCountry, setCountry, showModal, dismissModal }}>
      {children}
    </CountryContext.Provider>
  );
}

export function useCountry() {
  const ctx = useContext(CountryContext);
  if (!ctx) throw new Error('useCountry must be used inside CountryProvider');
  return ctx;
}
