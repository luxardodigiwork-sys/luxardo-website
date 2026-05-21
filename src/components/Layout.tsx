import React, { useState, useEffect } from 'react';
import { 
  Menu, X, Search, ShoppingBag, User, Globe, 
  Instagram, Facebook, Twitter, ArrowRight, Plus, Minus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Country, Language } from '../types';
import { COUNTRIES, LANGUAGES, COLLECTIONS } from '../constants';
import { ALL_COUNTRIES } from '../countries';
import Logo from './Logo';
import ComplianceFooter from './ComplianceFooter';
import { BUSINESS_CONFIG } from '../constants/businessConfig';
import WhatsAppButton from './WhatsAppButton';
import Animated3DHeader from './Animated3DHeader';
import { SearchOverlay } from './SearchOverlay';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

import { storage } from '../utils/localStorage';
import { firebaseStorage } from '../utils/firebaseStorage';

function ScrollToTopOnMount() {
  const location = useLocation();
  
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if ((window as any).lenis) {
      (window as any).lenis.start();
      (window as any).lenis.scrollTo(0, { immediate: true });
    }
  }, [location.key]);
  
  return null;
}

export default function Layout() {
  const siteContent = storage.getSiteContent();
  const [footerContent, setFooterContent] = useState(siteContent.footer);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('English (US)');
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showCollectionsDropdown, setShowCollectionsDropdown] = useState(false);
  const [showLoginReminder, setShowLoginReminder] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [reminderCount, setReminderCount] = useState(0);
  const [openFooterSection, setOpenFooterSection] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { cartCount } = useCart();
  const { isLoggedIn, user, isAuthReady, updateUserPreferences } = useAuth();

  const toggleFooterSection = (section: string) => {
    setOpenFooterSection(prev => prev === section ? null : section);
  };

  // Initialize from Firebase/localStorage
  useEffect(() => {
    const initPreferences = async () => {
      const updatedSiteContent = storage.getSiteContent();
      setFooterContent(updatedSiteContent.footer);
      
      try {
        // Try to load from Firebase first
        const savedPrefs = await firebaseStorage.getUserPreferences();
        const firstVisitCompleted = await firebaseStorage.isFirstVisitComplete();
        
        if (savedPrefs?.country) {
          const country = ALL_COUNTRIES.find(c => c.code === savedPrefs.country);
          if (country) setSelectedCountry(country);
        } else if (firstVisitCompleted) {
          // Fallback to localStorage if Firebase doesn't have data
          const savedCountry = localStorage.getItem('LUXARDO FASHION_country');
          if (savedCountry) {
            const country = ALL_COUNTRIES.find(c => c.code === savedCountry);
            if (country) setSelectedCountry(country);
          }
        } else {
          // Show first visit modal
        }
        if (savedPrefs?.language) {
          setSelectedLanguage(savedPrefs.language as Language);
        } else {
          const savedLang = localStorage.getItem('LUXARDO FASHION_lang');
          if (savedLang) {
            setSelectedLanguage(savedLang as Language);
          } else {
            setSelectedLanguage('English (US)');
          }
        }
      } catch (err) {
        console.error('Failed to initialize preferences:', err);
        // Fallback to localStorage
        const savedCountry = localStorage.getItem('LUXARDO FASHION_country');
        const savedLang = localStorage.getItem('LUXARDO FASHION_lang');
        const firstVisitCompleted = localStorage.getItem('LUXARDO FASHION_first_visit_completed');
        
        if (savedCountry && firstVisitCompleted) {
          const country = ALL_COUNTRIES.find(c => c.code === savedCountry);
          if (country) setSelectedCountry(country);
        }
        if (savedLang) {
          setSelectedLanguage(savedLang as Language);
        }
      }
    };
    
    initPreferences();
  }, []);

  // Sync preferences with user profile
  useEffect(() => {
    if (isAuthReady && user && user.role !== 'admin') {
      const localCountry = localStorage.getItem('LUXARDO FASHION_country');
      const localLang = localStorage.getItem('LUXARDO FASHION_lang');
      const localCurrency = localStorage.getItem('LUXARDO FASHION_currency');

      if (user.country && user.country !== localCountry) {
        const country = ALL_COUNTRIES.find(c => c.code === user.country) ||
                        ALL_COUNTRIES.find(c => c.name === user.country);
        if (country) {
          setSelectedCountry(country);
          localStorage.setItem('LUXARDO FASHION_country', country.code);
          localStorage.setItem('LUXARDO FASHION_first_visit_completed', 'true');
        }
      }
      if (user.language && user.language !== localLang) {
        setSelectedLanguage(user.language as Language);
        localStorage.setItem('LUXARDO FASHION_lang', user.language);
      }
      if (user.currency && user.currency !== localCurrency) {
        localStorage.setItem('LUXARDO FASHION_currency', user.currency);
      }
    }
  }, [isAuthReady, user]);

  // Login Reminder Logic — only show to logged-out users
  useEffect(() => {
    if (isLoggedIn) {
      setShowLoginReminder(false);
      return;
    }

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

  }, [isLoggedIn, reminderCount]);
  // Close menu on route change and handle scroll lock during transition
  useEffect(() => {
    setIsMenuOpen(false);
    
    // Stop lenis briefly during page transition, then restart
    if ((window as any).lenis) {
      (window as any).lenis.stop();
      setTimeout(() => {
        if ((window as any).lenis) {
          (window as any).lenis.start();
        }
      }, 100);
    }
  }, [location.pathname]);

  // Handle scroll for sticky header shrink effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    // Initial check
    handleScroll();
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock body scroll when any modal/overlay is open
  useEffect(() => {
    if (isMenuOpen || isSearchOpen || showRegionModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMenuOpen, isSearchOpen, showRegionModal]);
  const handleCountrySelect = (country: Country) => {
    if (country.active) {
      setSelectedCountry(country);
      
      // Save to localStorage as fallback
      localStorage.setItem('LUXARDO FASHION_country', country.code);
      localStorage.setItem('LUXARDO FASHION_currency', country.currency.code);
      
      const defaultLang = country.language;
      setSelectedLanguage(defaultLang);
      localStorage.setItem('LUXARDO FASHION_lang', defaultLang);
      
      // Save to Firebase if user is logged in
      if (isLoggedIn && user && user.role !== 'admin') {
        firebaseStorage.saveUserPreferences({
          country: country.code,
          language: defaultLang,
          currency: country.currency.code
        }).catch(err => console.error('Failed to save preferences:', err));
        
        updateUserPreferences({
          country: country.code,
          language: defaultLang,
          currency: country.currency.code
        });
      }
      
      setShowRegionModal(false);
    }
  };

  const scrollToTop = () => {
    if ((window as any).lenis) {
      (window as any).lenis.scrollTo(0, { immediate: true });
    } else {
      window.scrollTo(0, 0);
    }
  };

  const handleLanguageSelect = (lang: Language) => {
    setSelectedLanguage(lang);
    localStorage.setItem('LUXARDO FASHION_lang', lang);
    
    if (isLoggedIn && user && user.role !== 'admin') {
      firebaseStorage.saveUserPreferences({ language: lang })
        .catch(err => console.error('Failed to save language preference:', err));
      
      updateUserPreferences({ language: lang });
    }
  };


  const navItems = [
    { name: 'HOME', path: '/' },
    { name: 'CRAFTSMANSHIP', path: '/craftsmanship' },
    { name: 'COLLECTIONS', path: '/collections' },
    { name: 'PARTNER WITH US', path: '/wholesale' },
    { name: 'PRIME MEMBER', path: '/prime-membership' },
    { name: 'CONTACT', path: '/contact' }
  ];

  const collectionItems = COLLECTIONS.map(col => ({
    name: col.shortName,
    path: `/collections/${col.id}`
  }));


  return (
    <div className="min-h-screen w-full max-w-full bg-brand-bg text-brand-black selection:bg-brand-black selection:text-brand-white flex flex-col overflow-x-hidden">
      {/* First Visit Modal */}
      <AnimatePresence>
      </AnimatePresence>

      {/* Top Bar (Layer 1) */}
      <div className="bg-brand-black text-brand-white py-1.5 md:py-2 px-4 md:px-12">
        <div className="max-w-[1800px] mx-auto flex justify-between items-center text-[8px] md:text-[10px] uppercase tracking-[0.2em] md:tracking-[0.3em] font-bold">
          <div className="flex items-center gap-2 md:gap-4">
            <button onClick={() => setShowRegionModal(true)} className="flex items-center gap-1.5 md:gap-2 hover:text-brand-secondary transition-colors">
              <Globe className="w-2.5 h-2.5 md:w-3 md:h-3" />
              {selectedCountry?.name || 'Select Region'}
            </button>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <button onClick={() => setShowRegionModal(true)} className="hover:text-brand-secondary transition-colors">
              {selectedLanguage}
            </button>
          </div>
        </div>
      </div>

      {/* Main Header (Layer 2) */}
      <header className={`sticky top-0 z-40 bg-brand-bg/95 backdrop-blur-md border-b border-brand-divider transition-all duration-500 ${isScrolled ? 'py-1 md:py-1.5 shadow-md scale-[0.98]' : 'py-3 md:py-4'}`}>
        <div className="max-w-[1800px] mx-auto px-4 md:px-12 flex items-center justify-between">
          {/* Left: Logo */}
          <div className="flex-1 flex items-center">
            <Link to="/" className="flex items-center">
              <Logo className={`transition-all duration-500 ${isScrolled ? 'h-[24px] md:h-[30px] w-[100px] md:w-[140px]' : 'h-[40px] md:h-[52px] w-[170px] md:w-[220px]'}`} />
            </Link>
          </div>
          
          {/* Center: Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-8">
            {navItems.map(item => {
              const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
              <div 
                key={item.name} 
                className="relative"
                onPointerEnter={(e) => e.pointerType === 'mouse' && item.name === 'COLLECTIONS' && setShowCollectionsDropdown(true)}
                onPointerLeave={(e) => e.pointerType === 'mouse' && item.name === 'COLLECTIONS' && setShowCollectionsDropdown(false)}
              >
                <Link 
                  to={item.path} 
                  onClick={() => {
                    if (item.name === 'COLLECTIONS') {
                      setShowCollectionsDropdown(false);
                    }
                    if (window.location.pathname === item.path) {
                      scrollToTop();
                    }
                  }}
                  className={`nav-link ${isActive ? 'nav-link-active' : ''}`}
                >
                  {item.name}
                </Link>
                
                {/* Collections Dropdown */}
                {item.name === 'COLLECTIONS' && (
                  <AnimatePresence>
                    {showCollectionsDropdown && (
                      <motion.div 
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5, pointerEvents: 'none' }}
                        className="absolute top-full left-1/2 -translate-x-1/2 pt-4 w-64 z-50"
                      >
                        <div className="bg-brand-white border border-brand-divider p-8 shadow-2xl flex flex-col gap-4">
                          {collectionItems.map(col => {
                            const isColActive = location.pathname === col.path;
                            return (
                            <Link 
                              key={col.name} 
                              to={col.path} 
                              onClick={() => {
                                setShowCollectionsDropdown(false);
                                if (window.location.pathname === col.path) {
                                  scrollToTop();
                                }
                              }}
                              className={`text-left text-sm font-sans transition-colors ${isColActive ? 'text-brand-black font-medium' : 'text-brand-secondary hover:text-brand-black'}`}
                            >
                              {col.name}
                            </Link>
                          )})}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </div>
            )})}
          </nav>

          {/* Right: Icons & Hamburger */}
          <div className="flex-1 flex justify-end items-center gap-3 md:gap-6">
            <button onClick={() => setIsSearchOpen(true)} className="hover:text-brand-secondary transition-colors"><Search className="w-[18px] h-[18px] md:w-6 md:h-6" /></button>
            <Link to={isLoggedIn ? "/account" : "/login"} className="hover:text-brand-secondary transition-colors"><User className="w-[18px] h-[18px] md:w-6 md:h-6" /></Link>
            <Link to="/cart" className="hover:text-brand-secondary transition-colors relative">
              <ShoppingBag className="w-[18px] h-[18px] md:w-6 md:h-6" />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 md:-top-2 md:-right-2 w-4 h-4 md:w-5 md:h-5 bg-brand-black text-brand-white rounded-full flex items-center justify-center text-[8px] md:text-[10px] font-bold">
                  {cartCount}
                </span>
              )}
            </Link>
            <button onClick={() => setIsMenuOpen(true)} className="lg:hidden ml-1 md:ml-2">
              <Menu className="w-5 h-5 md:w-7 md:h-7" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 z-[90] bg-brand-black/40 backdrop-blur-sm lg:hidden"
            />
            {/* Drawer */}
            <motion.div 
              key="mobile-menu"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-[85vw] max-w-[400px] z-[100] bg-brand-bg flex flex-col shadow-2xl lg:hidden"
            >
              <div className="p-6 flex justify-between items-center border-b border-brand-divider">
                <Logo className="h-6 w-auto" />
                <button onClick={() => setIsMenuOpen(false)} className="text-brand-black hover:text-brand-secondary transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8">
                {navItems.map(item => {
                  const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                  return (
                  <div key={item.name} className="flex flex-col gap-4">
                    <Link 
                      to={item.path} 
                      onClick={() => {
                        setIsMenuOpen(false);
                        if (window.location.pathname === item.path) {
                          scrollToTop();
                        }
                      }} 
                      className={`text-left text-xl font-display uppercase tracking-widest transition-colors ${isActive ? 'text-brand-black font-bold' : 'text-brand-black/70 hover:text-brand-black'}`}
                    >
                      {item.name}
                    </Link>
                    {item.name === 'COLLECTIONS' && (
                      <div className="pl-4 flex flex-col gap-4 border-l border-brand-divider">
                        {collectionItems.map(col => {
                          const isColActive = location.pathname === col.path;
                          return (
                          <Link 
                            key={col.name} 
                            to={col.path} 
                            onClick={() => {
                              setIsMenuOpen(false);
                              if (window.location.pathname === col.path) {
                                scrollToTop();
                              }
                            }} 
                            className={`text-left text-sm font-sans transition-colors ${isColActive ? 'text-brand-black font-medium' : 'text-brand-secondary hover:text-brand-black'}`}
                          >
                            {col.name}
                          </Link>
                        )})}
                      </div>
                    )}
                  </div>
                )})}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Login Reminder Toast */}
      <AnimatePresence>
        {showLoginReminder && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50, pointerEvents: 'none' }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md bg-brand-black text-brand-white p-4 shadow-2xl flex items-center justify-between cursor-pointer"
            onClick={() => {
              setShowLoginReminder(false);
              navigate('/login');
            }}
          >
            <div className="flex items-center gap-4">
              <User className="w-5 h-5" />
              <div>
                <p className="text-[11px] uppercase tracking-widest font-bold mb-1">Welcome to LUXARDO FASHION</p>
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
            exit={{ opacity: 0, pointerEvents: 'none' }}
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
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="h-full min-h-screen"
          >
            <ScrollToTopOnMount />
            <Outlet context={{ selectedCountry, selectedLanguage }} />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <ComplianceFooter />

      <SearchOverlay isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <WhatsAppButton />
    </div>
  );


}