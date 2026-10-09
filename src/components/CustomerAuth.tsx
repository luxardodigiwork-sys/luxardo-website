// src/components/CustomerAuth.tsx
// ✅ FIXED: reCAPTCHA uses useRef (not window global) + unique container ID per mount + cleanup on unmount

import React, { useState, useEffect, useRef, useCallback } from 'react';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import { motion, AnimatePresence } from 'motion/react'; // ✅ Fixed: was framer-motion
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../firebase';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ArrowRight, Loader2, ArrowLeft, ShieldCheck, KeyRound, Globe, Lock } from 'lucide-react';

// ─── Extend window ONLY for grecaptcha reset (not for our verifier) ──────────
declare global {
  interface Window {
    grecaptcha?: any;
  }
}

export function CustomerAuth() {
  const [phoneNumber, setPhoneNumber]       = useState('');
  const [otp, setOtp]                       = useState('');
  const [step, setStep]                     = useState<'phone' | 'otp'>('phone');
  const [error, setError]                   = useState('');
  const [isLoading, setIsLoading]           = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  // ✅ KEY FIX 1: Store verifier in a ref — never on window
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  // ✅ KEY FIX 2: Generate a UNIQUE container ID on every mount
  // This ensures the old ghost element from a previous mount can never be reused
  const containerIdRef = useRef<string>(
    `rcv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  );

  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  // ─── Initialize (or re-initialize) reCAPTCHA ──────────────────────────────
  const initRecaptcha = useCallback(() => {
    // Step 1: Always clear the old verifier before creating a new one
    if (recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current.clear();
      } catch (_) {
        // Ignore — element may already be gone
      }
      recaptchaVerifierRef.current = null;
    }

    // Step 2: Check the container exists in DOM before initializing
    const container = document.getElementById(containerIdRef.current);
    if (!container) {
      console.warn('[CustomerAuth] reCAPTCHA container not found in DOM yet.');
      return;
    }

    try {
      recaptchaVerifierRef.current = new RecaptchaVerifier(
        auth,
        containerIdRef.current, // ✅ Points to this mount's unique div
        {
          size: 'invisible',
          callback: () => {},
          'expired-callback': () => {
            setError('Verification session expired. Please try again.');
            setIsLoading(false);
            // Auto re-init after expiry so next attempt works
            initRecaptcha();
          },
        }
      );
    } catch (e) {
      console.error('[CustomerAuth] Failed to initialize RecaptchaVerifier:', e);
    }
  }, []); // No deps — containerIdRef.current is stable for this mount's lifetime

  // ─── Mount: init reCAPTCHA | Unmount: destroy it ─────────────────────────
  useEffect(() => {
    // Wait one tick so the JSX div is guaranteed to be in the DOM
    const timerId = setTimeout(() => {
      initRecaptcha();
    }, 0);

    return () => {
      clearTimeout(timerId);
      // ✅ KEY FIX 3: Always clear on unmount — eliminates the ghost element error
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch (_) {}
        recaptchaVerifierRef.current = null;
      }
    };
  }, [initRecaptcha]);

  // ─── Send OTP ──────────────────────────────────────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!phoneNumber || phoneNumber.length < 8) {
      setError('Please enter a valid mobile number with country code.');
      return;
    }

    setIsLoading(true);
    try {
      // Re-initialize if verifier was lost (e.g., after a previous error)
      if (!recaptchaVerifierRef.current) {
        initRecaptcha();
        // Small delay to let the new verifier render
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      if (!recaptchaVerifierRef.current) {
        throw new Error('Could not initialize security check. Please refresh the page.');
      }

      const formattedPhone = '+' + phoneNumber;
      const confirmation = await signInWithPhoneNumber(
        auth,
        formattedPhone,
        recaptchaVerifierRef.current
      );

      setConfirmationResult(confirmation);
      setStep('otp');
    } catch (err: any) {
      console.error('[CustomerAuth] sendOTP error:', err);

      // ✅ KEY FIX 4: On ANY error, fully reset the verifier so the next attempt works
      if (recaptchaVerifierRef.current) {
        try { recaptchaVerifierRef.current.clear(); } catch (_) {}
        recaptchaVerifierRef.current = null;
      }
      initRecaptcha();

      // Surface a friendly message
      if (err.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please wait a few minutes and try again.');
      } else if (err.code === 'auth/invalid-phone-number') {
        setError('Invalid phone number. Please include your country code.');
      } else {
        setError(err.message || 'Failed to send OTP. Please check your connection.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Verify OTP ────────────────────────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!otp || otp.length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    try {
      if (!confirmationResult) {
        throw new Error('Session lost. Please go back and request a new code.');
      }

      const result = await confirmationResult.confirm(otp);
      const user   = result.user;

      // Upsert user document in Firestore
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc    = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          phoneNumber : user.phoneNumber,
          role        : 'customer',
          createdAt   : serverTimestamp(),
        });
      }

      // Navigate away — avoid redirecting back to login/register
      const destination =
        from === '/login' || from === '/register' ? '/' : from;
      navigate(destination, { replace: true });

    } catch (err: any) {
      console.error('[CustomerAuth] verifyOTP error:', err);
      if (err.code === 'auth/invalid-verification-code') {
        setError('Incorrect code. Please double-check and try again.');
      } else if (err.code === 'auth/code-expired') {
        setError('Code expired. Please go back and request a new one.');
      } else {
        setError('Verification failed. Please try again or request a new code.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ─── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-sm md:max-w-md mx-auto p-8 bg-brand-bg rounded-3xl md:shadow-2xl md:border border-brand-black/5 relative transition-all duration-300">

      {/*
        ✅ KEY FIX 5: The reCAPTCHA container is rendered FIRST (before all other UI)
        and uses the stable unique ID from containerIdRef.
        It must ALWAYS be in the DOM as long as this component is mounted.
        NEVER conditionally render or hide it with display:none.
      */}
      <div
        id={containerIdRef.current}
        aria-hidden="true"
        style={{ position: 'absolute', bottom: 0, left: 0, opacity: 0, pointerEvents: 'none' }}
      />

      <div className="relative z-10">

        {/* Branding */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Globe className="w-5 h-5 text-brand-black opacity-80" />
            <span className="font-display text-sm uppercase tracking-widest text-brand-black">
              Luxardo Customer Portal
            </span>
          </div>

          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-brand-black shadow-[0_8px_32px_rgba(0,0,0,0.08)] mb-4 border border-brand-black/5">
            <ShieldCheck size={22} className="stroke-[1.5]" />
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-display font-medium text-brand-black">Client Login</h2>
            <div className="flex items-center justify-center gap-1.5 mt-2 text-brand-secondary">
              <Lock size={10} className="opacity-70" />
              <p className="text-[9px] font-sans uppercase tracking-[0.2em]">
                Secured with 2-Factor Authentication
              </p>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">

          {/* ── Step 1: Phone Number ── */}
          {step === 'phone' && (
            <motion.form
              key="phone-form"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25 }}
              onSubmit={handleSendOtp}
              className="space-y-6"
            >
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-brand-black block">
                  Mobile Number
                </label>

                <PhoneInput
                  country={'in'}
                  value={phoneNumber}
                  onChange={(phone) => setPhoneNumber(phone)}
                  enableSearch={true}
                  disableSearchIcon={true}
                  inputProps={{ name: 'phone', required: true, autoFocus: true }}
                  containerClass="!w-full font-sans shadow-sm"
                  inputClass="!w-full !h-[54px] !pl-16 !bg-white !border !border-brand-black/20 focus:!border-brand-black transition-colors !rounded-xl !text-lg !text-brand-black !font-medium"
                  buttonClass="!bg-white !border-0 !border-r !border-brand-black/20 !rounded-l-xl hover:!bg-brand-black/5 !w-12"
                  dropdownClass="!bg-brand-bg !shadow-2xl !border !border-brand-divider !rounded-xl text-sm"
                  searchClass="!bg-brand-black/5 !border-none !rounded-md !px-4 !py-2 !w-full"
                />

                <div className="h-4">
                  {phoneNumber.length > 3 ? (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-[10px] text-brand-secondary animate-pulse italic"
                    >
                      Confirming number for authentication...
                    </motion.p>
                  ) : (
                    <p className="text-[10px] text-brand-secondary/60">
                      Enter your registered mobile number with country code.
                    </p>
                  )}
                </div>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-600 text-xs flex items-start gap-2 bg-red-50 p-3 rounded-lg border border-red-100/50"
                >
                  <div className="w-1 h-4 bg-red-500 rounded-full mt-0.5 shrink-0" />
                  {error}
                </motion.p>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-14 px-6 bg-brand-black text-brand-white text-[11px] uppercase tracking-[0.2em] font-bold rounded-xl shadow-[0_4px_14px_0_rgba(0,0,0,0.39)] hover:bg-brand-black/90 transition-all flex justify-between items-center group disabled:opacity-50"
              >
                <span>Continue to Verify</span>
                {isLoading
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                }
              </button>

              <div className="flex justify-between items-center pt-2 text-[9px] uppercase tracking-widest text-brand-secondary">
                <button type="button" className="hover:text-brand-black transition-colors">
                  Forgot number?
                </button>
                <button type="button" className="hover:text-brand-black transition-colors">
                  Need assistance?
                </button>
              </div>
            </motion.form>
          )}

          {/* ── Step 2: OTP Verification ── */}
          {step === 'otp' && (
            <motion.form
              key="otp-form"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25 }}
              onSubmit={handleVerifyOtp}
              className="space-y-6"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-brand-black">
                    Security Code
                  </label>
                  <button
                    type="button"
                    onClick={() => { setStep('phone'); setOtp(''); setError(''); }}
                    disabled={isLoading}
                    className="text-[10px] text-brand-secondary hover:underline uppercase flex items-center gap-1"
                  >
                    <ArrowLeft size={10} /> Change Number
                  </button>
                </div>

                <div className="relative">
                  <KeyRound className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-secondary w-5 h-5" />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))
                    }
                    placeholder="• • • • • •"
                    className="w-full bg-white border border-brand-black/20 focus:border-brand-black pl-14 pr-4 h-[54px] text-2xl tracking-[0.4em] font-medium font-sans text-brand-black rounded-xl outline-none shadow-sm"
                    autoFocus
                  />
                </div>

                <p className="text-[10px] text-brand-secondary/60">
                  We sent a 6-digit code to{' '}
                  <span className="font-bold text-brand-black">+{phoneNumber}</span>
                </p>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-600 text-xs flex items-start gap-2 bg-red-50 p-3 rounded-lg border border-red-100/50"
                >
                  <div className="w-1 h-4 bg-red-500 rounded-full mt-0.5 shrink-0" />
                  {error}
                </motion.p>
              )}

              <button
                type="submit"
                disabled={isLoading || otp.length !== 6}
                className="w-full h-14 px-6 bg-brand-black text-brand-white text-[11px] uppercase tracking-[0.2em] font-bold rounded-xl shadow-[0_4px_14px_0_rgba(0,0,0,0.39)] hover:bg-brand-black/90 transition-all flex justify-between items-center group disabled:opacity-50"
              >
                <span>Verify & Login</span>
                {isLoading
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                }
              </button>

              <div className="flex justify-between items-center pt-2 text-[9px] uppercase tracking-widest text-brand-secondary">
                <button
                  type="button"
                  onClick={() => { setStep('phone'); setOtp(''); setError(''); }}
                  className="hover:text-brand-black transition-colors"
                >
                  Didn't receive code?
                </button>
                <button type="button" className="hover:text-brand-black transition-colors">
                  Contact Support
                </button>
              </div>
            </motion.form>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
