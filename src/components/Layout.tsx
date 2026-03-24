import React, { useState, useEffect } from 'react';
import { 
  Menu, X, Search, ShoppingBag, User, Globe, 
  Instagram, Facebook, Twitter, ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Country, Language } from '../types';
import { COUNTRIES, LANGUAGES, COLLECTIONS } from '../constants';
import { ALL_COUNTRIES } from '../countries';
import { Logo } from './Logo';
import { FirstVisitModal } from './FirstVisitModal';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

import { storage } from '../utils/localStorage';

export default function Layout() {
  const siteContent = storage.getSiteContent();
  const [footerContent, setFooterContent] = useState(siteContent.footer);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('English (US)');
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [showFirstVisitModal, setShowFirstVisitModal] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showCollectionsDropdown, setShowCollectionsDropdown] = useState(false);
  const [showLoginReminder, setShowLoginReminder] = useState(false);
  const [reminderCount, setReminderCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const { cartCount } = useCart();
  const { isLoggedIn } = useAuth();

  // Initialize from localStorage
  useEffect(() => {
    const updatedSiteContent = storage.getSiteContent();
    setFooterContent(updatedSiteContent.footer);
    
    const savedCountry = localStorage.getItem('luxardo_country');
    const savedLang = localStorage.getItem('luxardo_lang');
    
    if (savedCountry) {
      const country = ALL_COUNTRIES.find(c => c.code === savedCountry);
      if (country) setSelectedCountry(country);
    } else {
      // Show first visit modal
      setShowFirstVisitModal(true);
    }

    if (savedLang) {
      setSelectedLanguage(savedLang as Language);
    } else {
      // Default to English (US)
      setSelectedLanguage('English (US)');
      localStorage.setItem('luxardo_lang', 'English (US)');
    }
  }, []);

  // Login Reminder Logic
  useEffect(() => {
    if (isLoggedIn || showFirstVisitModal || showLoginReminder || reminderCount >= 3) return;

    const delay = reminderCount === 0 ? 5000 : 30000;
    
    const timer = setTimeout(() => {
      setShowLoginReminder(true);
      setReminderCount(prev => prev + 1);
      
      // Auto hide after 5 seconds
      setTimeout(() => {
        setShowLoginReminder(false);
      }, 5000);
      
    }, delay);

    return () => clearTimeout(timer);
  }, [isLoggedIn, showFirstVisitModal, reminderCount, showLoginReminder]);

  // Close menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  const handleCountrySelect = (country: Country) => {
    if (country.active) {
      setSelectedCountry(country);
      localStorage.setItem('luxardo_country', country.code);
      
      // Default language for the country if not already set to a supported one
      let newLang = selectedLanguage;
      if (country.code === 'AE' && selectedLanguage !== 'Arabic' && selectedLanguage !== 'English (US)') {
        newLang = 'English (US)';
      } else if (country.code === 'FR' && selectedLanguage !== 'French' && selectedLanguage !== 'English (US)') {
        newLang = 'English (US)';
      } else if (country.code !== 'AE' && country.code !== 'FR' && selectedLanguage !== 'English (US)') {
        newLang = 'English (US)';
      }
      
      setSelectedLanguage(newLang);
      localStorage.setItem('luxardo_lang', newLang);
      setShowRegionModal(false);
    }
  };

  const handleLanguageSelect = (lang: Language) => {
    setSelectedLanguage(lang);
    localStorage.setItem('luxardo_lang', lang);
  };

  const handleFirstVisitSelect = (country: Country) => {
    setSelectedCountry(country);
    localStorage.setItem('luxardo_country', country.code);
    setShowFirstVisitModal(false);
    // Redirect to home if not already there
    if (location.pathname !== '/') {
      navigate('/');
    }
  };

  const navItems = [
    { name: 'HOME', path: '/' },
    { name: 'OUR STORY', path: '/our-story' },
    { name: 'CRAFTSMANSHIP', path: '/craftsmanship' },
    { name: 'COLLECTIONS', path: '/collections' },
    { name: 'WHOLESALE', path: '/wholesale' },
    { name: 'PRIME MEMBER', path: '/prime-membership' },
    { name: 'CONTACT', path: '/contact' }
  ];

  const collectionItems = COLLECTIONS.map(col => ({
    name: col.shortName,
    path: `/collections/${col.id}`
  }));

  return (
    <div className="min-h-screen bg-brand-bg text-brand-black selection:bg-brand-black selection:text-brand-white flex flex-col">
      {/* First Visit Modal */}
      {showFirstVisitModal && <FirstVisitModal onSelect={handleFirstVisitSelect} />}

      {/* Top Bar (Layer 1) */}
      <div className="bg-brand-black text-brand-white py-2 px-6 md:px-12">
        <div className="max-w-[1800px] mx-auto flex justify-between items-center text-[9px] md:text-[10px] uppercase tracking-[0.3em] font-bold">
          <div className="flex items-center gap-4">
            <button onClick={() => setShowRegionModal(true)} className="flex items-center gap-2 hover:text-brand-secondary transition-colors">
              <Globe className="w-3 h-3" />
              {selectedCountry?.name || 'Select Region'} ({selectedCountry?.currency.code})
            </button>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setShowRegionModal(true)} className="hover:text-brand-secondary transition-colors">
              {selectedLanguage}
            </button>
          </div>
        </div>
      </div>

      {/* Main Header (Layer 2) */}
      <header className="sticky top-0 z-40 bg-brand-bg/95 backdrop-blur-md border-b border-brand-divider">
        <div className="max-w-[1800px] mx-auto px-6 md:px-12 py-3.5 flex items-center justify-between">
          {/* Left: Logo */}
          <div className="flex-1 flex items-center">
            <Link to="/" className="flex items-center">
              <Logo className="h-[48px] w-[210px]" />
            </Link>
          </div>
          
          {/* Center: Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-8">
            {navItems.map(item => (
              <div 
                key={item.name} 
                className="relative"
                onMouseEnter={() => item.name === 'COLLECTIONS' && setShowCollectionsDropdown(true)}
                onMouseLeave={() => item.name === 'COLLECTIONS' && setShowCollectionsDropdown(false)}
              >
                <Link to={item.path} className="text-[13px] uppercase tracking-[0.2em] font-bold text-brand-secondary hover:text-brand-black transition-colors">
                  {item.name}
                </Link>
                
                {/* Collections Dropdown */}
                {item.name === 'COLLECTIONS' && (
                  <AnimatePresence>
                    {showCollectionsDropdown && (
                      <motion.div 
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="absolute top-full left-1/2 -translate-x-1/2 pt-4 w-64"
                      >
                        <div className="bg-brand-white border border-brand-divider p-8 shadow-2xl flex flex-col gap-4">
                          {collectionItems.map(col => (
                            <Link key={col.name} to={col.path} className="text-left text-sm font-sans text-brand-secondary hover:text-brand-black transition-colors">
                              {col.name}
                            </Link>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </div>
            ))}
          </nav>

          {/* Right: Icons & Hamburger */}
          <div className="flex-1 flex justify-end items-center gap-4 md:gap-6">
            <button className="hover:text-brand-secondary transition-colors"><Search className="w-5 h-5 md:w-6 md:h-6" /></button>
            <Link to={isLoggedIn ? "/account" : "/login"} className="hover:text-brand-secondary transition-colors hidden sm:block"><User className="w-5 h-5 md:w-6 md:h-6" /></Link>
            <Link to="/cart" className="hover:text-brand-secondary transition-colors relative">
              <ShoppingBag className="w-5 h-5 md:w-6 md:h-6" />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 w-5 h-5 bg-brand-black text-brand-white rounded-full flex items-center justify-center text-[10px] font-bold">
                  {cartCount}
                </span>
              )}
            </Link>
            <button onClick={() => setIsMenuOpen(true)} className="lg:hidden ml-2">
              <Menu className="w-6 h-6 md:w-7 md:h-7" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-brand-bg flex flex-col"
          >
            <div className="p-6 flex justify-between items-center border-b border-brand-divider">
              <Logo className="h-6 w-auto" />
              <button onClick={() => setIsMenuOpen(false)}><X className="w-6 h-6" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8">
              {navItems.map(item => (
                <div key={item.name} className="flex flex-col gap-4">
                  <Link to={item.path} className="text-left text-xl font-display uppercase tracking-widest">{item.name}</Link>
                  {item.name === 'COLLECTIONS' && (
                    <div className="pl-4 flex flex-col gap-4 border-l border-brand-divider">
                      {collectionItems.map(col => (
                        <Link key={col.name} to={col.path} className="text-left text-sm font-sans text-brand-secondary">{col.name}</Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Login Reminder Toast */}
      <AnimatePresence>
        {showLoginReminder && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md bg-brand-black text-brand-white p-4 shadow-2xl flex items-center justify-between cursor-pointer"
            onClick={() => {
              setShowLoginReminder(false);
              navigate('/login');
            }}
          >
            <div className="flex items-center gap-4">
              <User className="w-5 h-5" />
              <div>
                <p className="text-[11px] uppercase tracking-widest font-bold mb-1">Welcome to Luxardo</p>
                <p className="text-sm font-sans opacity-80">Please log in to access your exclusive benefits.</p>
              </div>
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowLoginReminder(false);
              }}
              className="p-2 hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Region Modal */}
      <AnimatePresence>
        {showRegionModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-brand-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-brand-white w-full max-w-2xl p-8 md:p-12 relative"
            >
              <button onClick={() => setShowRegionModal(false)} className="absolute top-6 right-6">
                <X className="w-6 h-6" />
              </button>
              
              <h2 className="text-3xl font-display mb-12 text-center">Select Your Region</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div>
                  <h3 className="text-[11px] uppercase tracking-[0.25em] font-bold text-brand-secondary mb-6 border-b border-brand-divider pb-4">Country</h3>
                  <div className="space-y-4 relative">
                    <select
                      value={selectedCountry?.code || ''}
                      onChange={(e) => {
                        const country = ALL_COUNTRIES.find(c => c.code === e.target.value);
                        if (country) handleCountrySelect(country);
                      }}
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
                </div>
                
                <div>
                  <h3 className="text-[11px] uppercase tracking-[0.25em] font-bold text-brand-secondary mb-6 border-b border-brand-divider pb-4">Language</h3>
                  <div className="space-y-4">
                    {LANGUAGES.filter(lang => {
                      if (!selectedCountry) return lang === 'English (US)';
                      if (selectedCountry.code === 'AE') return lang === 'Arabic' || lang === 'English (US)';
                      if (selectedCountry.code === 'FR') return lang === 'French' || lang === 'English (US)';
                      return lang === 'English (US)';
                    }).map(lang => (
                      <button 
                        key={lang}
                        onClick={() => handleLanguageSelect(lang)}
                        className={`w-full text-left font-sans hover:text-brand-secondary transition-colors ${selectedLanguage === lang ? 'font-bold' : ''}`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1">
        <Outlet context={{ selectedCountry, selectedLanguage }} />
      </main>

      {/* Footer */}
      <footer className="bg-brand-black text-brand-white pt-32 pb-12 px-8 md:px-16 relative overflow-hidden mt-auto">
        {/* Large Watermark Logo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] opacity-[0.03] pointer-events-none flex justify-center">
          <Logo className="w-full" dark />
        </div>

        <div className="max-w-[1800px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-16 mb-32 relative z-10">
          <div className="space-y-8">
            <h4 className="text-[13px] uppercase tracking-[0.25em] font-bold text-brand-white">Collections</h4>
            <ul className="space-y-4 text-sm font-sans text-brand-white/60">
              {collectionItems.slice(0, 6).map(item => (
                <li key={item.name}><Link to={item.path} className="hover:text-brand-white transition-colors">{item.name}</Link></li>
              ))}
            </ul>
          </div>

          <div className="space-y-8">
            <h4 className="text-[13px] uppercase tracking-[0.25em] font-bold text-brand-white">Maison</h4>
            <ul className="space-y-4 text-sm font-sans text-brand-white/60">
              <li><Link to="/prime-membership" className="hover:text-brand-white transition-colors">Prime Member</Link></li>
              <li><Link to="/craftsmanship" className="hover:text-brand-white transition-colors">Craftsmanship</Link></li>
              <li><Link to="/our-story" className="hover:text-brand-white transition-colors">Our Story</Link></li>
              <li><Link to="/contact" className="hover:text-brand-white transition-colors">Contact</Link></li>
              <li><Link to="/faq" className="hover:text-brand-white transition-colors">FAQ</Link></li>
            </ul>
          </div>

          <div className="space-y-8">
            <h4 className="text-[13px] uppercase tracking-[0.25em] font-bold text-brand-white">Legal</h4>
            <ul className="space-y-4 text-sm font-sans text-brand-white/60">
              <li><Link to="/policies/shipping" className="hover:text-brand-white transition-colors">Shipping Policy</Link></li>
              <li><Link to="/policies/returns" className="hover:text-brand-white transition-colors">Returns Policy</Link></li>
              <li><Link to="/policies/privacy" className="hover:text-brand-white transition-colors">Privacy Policy</Link></li>
              <li><Link to="/policies/terms" className="hover:text-brand-white transition-colors">Terms & Conditions</Link></li>
              <li><Link to="/policies/membership-terms" className="hover:text-brand-white transition-colors">Membership Terms</Link></li>
            </ul>
          </div>

          <div className="space-y-12">
            <div className="space-y-8">
              <h4 className="text-[11px] uppercase tracking-[0.25em] font-bold text-brand-white">Newsletter</h4>
              <div className="flex border-b border-brand-white/20 pb-4 group">
                <input type="email" placeholder="Email Address" className="bg-transparent w-full text-sm font-sans text-brand-white focus:outline-none placeholder:text-brand-white/40" />
                <button className="text-brand-white hover:text-brand-white/60 transition-colors">
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-[11px] uppercase tracking-[0.25em] font-bold text-brand-white">Region</h4>
              <button onClick={() => setShowRegionModal(true)} className="flex items-center gap-2 text-sm font-sans text-brand-white/60 hover:text-brand-white transition-colors">
                <Globe className="w-4 h-4" /> {selectedCountry?.name || 'Select Region'}
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-[1800px] w-full mx-auto pt-8 border-t border-brand-white/10 flex flex-col md:flex-row justify-between items-center gap-6 relative z-10">
          <div className="flex-1 flex justify-center md:justify-start">
          </div>
          <p className="flex-1 text-[10px] uppercase tracking-[0.25em] font-bold text-brand-white/60 flex flex-wrap items-center justify-center gap-2 text-center">
            <span>© {footerContent?.copyrightYear || '2024'}</span>
            <Logo className="h-2.5 w-auto" dark />
            <span>{footerContent?.copyrightText || 'Luxardo Maison. All rights reserved.'}</span>
          </p>
          <div className="flex-1 flex justify-center md:justify-end gap-6">
            {footerContent?.socialLinks?.instagram && (
              <a href={footerContent.socialLinks?.instagram} target="_blank" rel="noopener noreferrer" className="text-brand-white/60 hover:text-brand-white transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
            )}
            {footerContent?.socialLinks?.facebook && (
              <a href={footerContent.socialLinks?.facebook} target="_blank" rel="noopener noreferrer" className="text-brand-white/60 hover:text-brand-white transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
            )}
            {footerContent?.socialLinks?.twitter && (
              <a href={footerContent.socialLinks?.twitter} target="_blank" rel="noopener noreferrer" className="text-brand-white/60 hover:text-brand-white transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
