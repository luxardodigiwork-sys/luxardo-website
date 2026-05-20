import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation, useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  GoogleAuthProvider,
  ConfirmationResult,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import Logo from '../components/Logo';
import { storage } from '../utils/localStorage';
import { ALL_COUNTRIES } from '../countries';

declare global { interface Window { recaptchaVerifier?: RecaptchaVerifier; } }

type Step = 'phone' | 'otp' | 'profile';

export default function LoginPage() {
  const navigate = useNavigate();

  const location = useLocation();
  const { user, isAuthReady, login } = useAuth();
  const outletContext: any = useOutletContext();

  const [step, setStep] = useState<Step>('phone');
  const [mobileNumber, setMobileNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(59);
  const [profile, setProfile] = useState({ firstName: '', lastName: '', email: '', gender: '', age: '' });
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [bgImage, setBgImage] = useState('https://images.unsplash.com/photo-1617137968427-85924c800a22?q=80&w=1974&auto=format&fit=crop');

  const [selectedCountry, setSelectedCountry] = useState(() => {
    const savedCode = localStorage.getItem('LUXARDO FASHION_country');
    return ALL_COUNTRIES.find(c => c.code === savedCode) || ALL_COUNTRIES.find(c => c.code === 'IN') || ALL_COUNTRIES[0];
  });

  const from = (location.state as any)?.from?.pathname || '/account';

  // Sync country from outlet context
  useEffect(() => {
    if (outletContext?.selectedCountry) {
      const match = ALL_COUNTRIES.find(c => c.code === outletContext.selectedCountry.code);
      if (match) setSelectedCountry(match);
    }
  }, [outletContext?.selectedCountry]);

  // Load hero bg image from site content
  useEffect(() => {
    const content = storage.getSiteContent();
    if (content?.homepage?.hero?.slides?.[0]?.imageUrl) {
      setBgImage(content.homepage.hero.slides[0].imageUrl);
    }
  }, []);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthReady && user) {
      if (['super_admin', 'admin'].includes(user.role)) {
        navigate('/admin/dashboard', { replace: true });
      } else if (user.role === 'dispatch' || user.role === 'owner' || user.role === 'analysis') {
        navigate('/backend', { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    }
  }, [user, isAuthReady, navigate, from]);

  // Initialize reCAPTCHA
  useEffect(() => {
    if (step === 'phone') {
      try {
        if (window.recaptchaVerifier) {
          window.recaptchaVerifier.clear();
          window.recaptchaVerifier = undefined;
        }
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'normal',
          callback: () => {},
          'expired-callback': () => {
            setError('reCAPTCHA expired. Please try again.');
          }
        });
        window.recaptchaVerifier.render();
      } catch (e) {
        console.error('Recaptcha error:', e);
      }
    }
  }, [step]);

  // Resend timer countdown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 'otp' && resendTimer > 0) {
      interval = setInterval(() => setResendTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [step, resendTimer]);

  const handleSendOTP = async () => {
    if (mobileNumber.length < 5) {
      setError('Please enter a valid mobile number');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const fullPhone = `${(selectedCountry as any).dial}${mobileNumber.replace(/^0+/, '')}`;
      const verifier = window.recaptchaVerifier!;
      const result = await signInWithPhoneNumber(auth, fullPhone, verifier);
      setConfirmation(result);
      setStep('otp');
      setResendTimer(59);
    } catch (err: any) {
      console.error('OTP send error:', err);
      setError('Failed to send OTP. Please check your number and try again.');
      // Reset recaptcha on error
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = undefined;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendTimer > 0) return;
    setError('');
    setLoading(true);
    try {
      const fullPhone = `${(selectedCountry as any).dial}${mobileNumber.replace(/^0+/, '')}`;
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = undefined;
      }
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'normal' });
      await window.recaptchaVerifier.render();
      const result = await signInWithPhoneNumber(auth, fullPhone, window.recaptchaVerifier);
      setConfirmation(result);
      setResendTimer(59);
    } catch (err: any) {
      setError('Failed to resend OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length < 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await confirmation!.confirm(otp);
      const uid = result.user.uid;
      const userDoc = await getDoc(doc(db, 'customers', uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        login({
          id: uid,
          name: data.firstName ? `${data.firstName} ${data.lastName || ''}`.trim() : data.name || 'Customer',
          email: data.email || '',
          role: data.role || 'customer',
          isPrimeMember: data.isPrimeMember || false,
          phone: data.phone,
        });
        navigate(from, { replace: true });
      } else {
        setStep('profile');
      }
    } catch (err: any) {
      setError('Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = async () => {
    if (!profile.firstName || !profile.lastName || !profile.email || !profile.gender || !profile.age) {
      setError('Please fill all fields');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const uid = auth.currentUser!.uid;
      const fullPhone = `${(selectedCountry as any).dial}${mobileNumber}`;
      const customerData = {
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        gender: profile.gender,
        age: profile.age,
        phone: fullPhone,
        role: 'customer',
        isPrimeMember: false,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'customers', uid), customerData);
      login({
        id: uid,
        name: `${profile.firstName} ${profile.lastName}`,
        email: profile.email,
        role: 'customer',
        isPrimeMember: false,
        phone: fullPhone,
      });
      navigate(from, { replace: true });
    } catch (err: any) {
      setError('Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-[#FBFBFA] font-sans">

      {/* Left Panel — Editorial */}
      <div className="hidden md:flex md:w-1/2 relative bg-black flex-col justify-between p-12 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src={bgImage}
            alt="LUXARDO FASHION Editorial"
            className="w-full h-full object-cover opacity-50"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 text-white tracking-[0.3em] font-semibold text-xs uppercase"
        >
          LUXARDO FASHION
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative z-10"
        >
          <h1 className="text-white text-5xl lg:text-6xl font-display leading-tight max-w-lg">
            Crafting Legacy,<br />Defining Elegance.
          </h1>
        </motion.div>
      </div>

      {/* Right Panel — Auth */}
      <div className="w-full md:w-1/2 flex flex-col justify-center items-center p-6 md:p-12 lg:p-20 bg-[#FBFBFA] relative">
        <div className="w-full max-w-md flex flex-col bg-white p-8 md:p-12 shadow-sm">

          {/* Logo + Title */}
          <div className="flex flex-col items-center mb-10">
            <Logo className="w-40 h-auto mb-5 text-black" />
            <p className="text-[#8E8E86] font-medium text-sm tracking-wide">
              {step === 'phone' && 'Access Your Account'}
              {step === 'otp' && 'Verify Your Number'}
              {step === 'profile' && 'Complete Your Profile'}
            </p>
          </div>

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-red-500 text-xs font-semibold text-center mb-6"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative w-full">
            <AnimatePresence mode="wait">

              {/* STEP 1 — Phone */}
              {step === 'phone' && (
                <motion.div
                  key="phone"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  className="w-full flex flex-col gap-6"
                >
                  {/* Phone Input */}
                  <div className="flex items-center border-b border-[#CFC7B8] focus-within:border-black transition-colors py-2 relative">
                    <button
                      type="button"
                      onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
                      className="flex items-center gap-2 pr-4 border-r border-[#CFC7B8] mr-4"
                    >
                      <img
                        src={`https://flagcdn.com/w40/${selectedCountry.code.toLowerCase()}.png`}
                        alt={selectedCountry.name}
                        className="w-6 h-auto border border-gray-100"
                      />
                      <span className="text-sm font-semibold text-black">{selectedCountry.code}</span>
                      <ChevronDown className="w-4 h-4 text-black" />
                    </button>

                    {/* Country Dropdown */}
                    <AnimatePresence>
                      {isCountryDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute top-[110%] left-0 w-72 bg-white border border-[#CFC7B8] shadow-xl z-50 max-h-64 overflow-y-auto"
                        >
                          {ALL_COUNTRIES.map((c) => (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => {
                                setSelectedCountry(c);
                                localStorage.setItem('LUXARDO FASHION_country', c.code);
                                setIsCountryDropdownOpen(false);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#FBFBFA] transition-colors text-left"
                            >
                              <img
                                src={`https://flagcdn.com/w40/${c.code.toLowerCase()}.png`}
                                alt={c.name}
                                className="w-5 h-auto border border-gray-100"
                              />
                              <span className="text-sm font-medium text-black flex-1">{c.name}</span>
                              <span className="text-xs text-[#8E8E86] font-mono">{(c as any).dial}</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <span className="text-sm font-semibold text-black mr-2">{(selectedCountry as any).dial}</span>
                    <input
                      type="tel"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      placeholder="Mobile Number"
                      className="w-full bg-transparent outline-none text-sm placeholder:text-[#8E8E86] text-black"
                    />
                  </div>

                  {/* reCAPTCHA */}
                  <div id="recaptcha-container" ref={recaptchaRef} className="flex justify-center"></div>

                  <button
                    type="button"
                    onClick={handleSendOTP}
                    disabled={loading || !mobileNumber}
                    className="w-full h-14 bg-black text-white uppercase tracking-[0.25em] text-[11px] hover:bg-gray-900 transition-colors disabled:opacity-40"
                  >
                    {loading ? 'Sending...' : 'Send OTP'}
                  </button>
                </motion.div>
              )}

              {/* STEP 2 — OTP */}
              {step === 'otp' && (
                <motion.div
                  key="otp"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  className="w-full flex flex-col gap-6"
                >
                  <p className="text-center text-sm text-[#8E8E86]">
                    OTP sent to <span className="font-semibold text-black">{(selectedCountry as any).dial} {mobileNumber}</span>
                  </p>

                  <input
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="• • • • • •"
                    autoFocus
                    className="w-full text-center text-3xl tracking-[1em] py-4 border-b border-[#CFC7B8] focus:border-black outline-none bg-transparent placeholder:text-[#CFC7B8] text-black"
                  />

                  <div className="flex flex-col items-center gap-2 text-sm text-[#8E8E86]">
                    {resendTimer > 0 ? (
                      <span>Resend OTP in 00:{String(resendTimer).padStart(2, '0')}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendOTP}
                        disabled={loading}
                        className="underline hover:text-black transition-colors"
                      >
                        Resend OTP
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => { setStep('phone'); setOtp(''); }}
                      className="text-xs hover:text-black transition-colors"
                    >
                      Change Number
                    </button>
                  </div>

                  {/* Hidden recaptcha for resend */}
                  <div id="recaptcha-container" className="hidden"></div>

                  <button
                    type="button"
                    onClick={handleVerifyOTP}
                    disabled={loading || otp.length < 6}
                    className="w-full h-14 bg-black text-white uppercase tracking-[0.25em] text-[11px] hover:bg-gray-900 transition-colors disabled:opacity-40"
                  >
                    {loading ? 'Verifying...' : 'Verify & Continue'}
                  </button>
                </motion.div>
              )}

              {/* STEP 3 — Profile */}
              {step === 'profile' && (
                <motion.div
                  key="profile"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  className="w-full flex flex-col gap-6"
                >
                  <div className="w-full p-4 bg-[#FBFBFA] border border-[#CFC7B8] flex items-center justify-between text-sm">
                    <span className="text-[#8E8E86]">Verified Number</span>
                    <span className="font-semibold text-black">{(selectedCountry as any).dial} {mobileNumber}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="First Name"
                      value={profile.firstName}
                      onChange={e => setProfile(p => ({ ...p, firstName: e.target.value }))}
                      required
                      className="w-full border-b border-[#CFC7B8] focus:border-black outline-none bg-transparent py-2 text-sm placeholder:text-[#8E8E86] text-black"
                    />
                    <input
                      type="text"
                      placeholder="Last Name"
                      value={profile.lastName}
                      onChange={e => setProfile(p => ({ ...p, lastName: e.target.value }))}
                      required
                      className="w-full border-b border-[#CFC7B8] focus:border-black outline-none bg-transparent py-2 text-sm placeholder:text-[#8E8E86] text-black"
                    />
                  </div>

                  <input
                    type="email"
                    placeholder="Email Address"
                    value={profile.email}
                    onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
                    required
                    className="w-full border-b border-[#CFC7B8] focus:border-black outline-none bg-transparent py-2 text-sm placeholder:text-[#8E8E86] text-black"
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="number"
                      placeholder="Age"
                      value={profile.age}
                      onChange={e => setProfile(p => ({ ...p, age: e.target.value }))}
                      min="18"
                      max="100"
                      required
                      className="w-full border-b border-[#CFC7B8] focus:border-black outline-none bg-transparent py-2 text-sm placeholder:text-[#8E8E86] text-black"
                    />
                    <div className="relative">
                      <select
                        value={profile.gender}
                        onChange={e => setProfile(p => ({ ...p, gender: e.target.value }))}
                        required
                        className="w-full border-b border-[#CFC7B8] focus:border-black outline-none bg-transparent py-2 text-sm text-black appearance-none"
                      >
                        <option value="" disabled>Gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                      <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-black pointer-events-none" />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleProfileSubmit}
                    disabled={loading}
                    className="w-full h-14 bg-black text-white uppercase tracking-[0.25em] text-[11px] hover:bg-gray-900 transition-colors mt-2 disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Complete Registration'}
                  </button>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>

        <p className="text-center text-[9px] uppercase tracking-[0.25em] text-[#8E8E86] mt-8">
          LUXARDO FASHION — Protected Authentication
        </p>
      </div>

    </div>
  );
}


