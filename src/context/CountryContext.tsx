import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Country } from '../types';
import { ALL_COUNTRIES } from '../countries';

interface CountryContextType {
  selectedCountry: Country | null;
  setCountry: (country: Country) => void;
  showModal: boolean;
  dismissModal: () => void;
}

const CountryContext = createContext<CountryContextType | null>(null);

const STORAGE_KEY = 'luxardo_country_code';

export function CountryProvider({ children }: { children: React.ReactNode }) {
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const found = ALL_COUNTRIES.find(c => c.code === saved);
      if (found) { setSelectedCountry(found); setShowModal(false); return; }
    }
    setShowModal(true);
  }, []);

  const setCountry = async (country: Country) => {
    setSelectedCountry(country);
    setShowModal(false);
    localStorage.setItem(STORAGE_KEY, country.code);
    try {
      const sessionId = localStorage.getItem('luxardo_session_id') || crypto.randomUUID();
      localStorage.setItem('luxardo_session_id', sessionId);
      await setDoc(doc(db, 'sessions', sessionId), {
        country: country.code,
        currency: country.currency.code,
        language: country.language,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (e) { console.error('Country save error:', e); }
  };

  const dismissModal = () => setShowModal(false);

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
