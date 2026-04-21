// src/components/AuthForm.tsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Phone, ArrowRight, AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// === FIREBASE IMPORTS ADDED HERE ===
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase'; // Aapka firebase config file

type AuthMode = 'signin' | 'signup';
type AuthStep = 'options' | 'email' | 'phone' | 'phone-otp';

interface AuthFormProps {
  initialMode?: AuthMode;
}

export function AuthForm({ initialMode = 'signin' }: AuthFormProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [step, setStep] = useState<AuthStep>('options');
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{email?: string, password?: string, phone?: string}>({});
  
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  useEffect(() => {
    setMode(initialMode);
    setStep('options');
    setError('');
    setFieldErrors({});
  }, [initialMode]);

  // Email Login Logic (Kept mostly as is)
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    let isValid = true;
    const errors: any = {};
    if (mode === 'signup' && password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
      isValid = false;
    }
    if (!isValid) {
      setFieldErrors(errors);
      return;
    }
    setIsLoading(true);
    try {
      if (mode === 'signin') {
        await login(email, password);
      } else {
        await register({ name, email, password });
      }
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || `Failed to ${mode === 'signin' ? 'login' : 'create account'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // === REAL FIREBASE PHONE AUTH SUBMIT ===
  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!phone || phone.length < 7) {
      setFieldErrors({ phone: 'Please enter a valid phone number' });
      return;
    }
    
    setIsLoading(true);
    try {
      // 1. Setup Recaptcha if it doesn't exist
      if (!(window as any).recaptchaVerifier) {
        (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: () => {
             // reCAPTCHA solved
          }
        });
      }

      // 2. Format Phone Number (Ensure it has country code)
      const formattedPhone = phone.startsWith('+') ? phone : `+91${phone.replace(/\D/g, '')}`;
      
      // 3. Send OTP
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, (window as any).recaptchaVerifier);
      (window as any).confirmationResult = confirmation;
      
      setStep('phone-otp');
    } catch (err: any) {
      console.error(err);
      setError("Failed to send OTP. Please try using a test number.");
      
      // Reset recaptcha on error so user can try again
      if ((window as any).recaptchaVerifier) {
         (window as any).recaptchaVerifier.render().then(function(widgetId: any) {
             (window as any).grecaptcha.reset(widgetId);
         });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // === REAL FIREBASE OTP VERIFICATION & ROLE CHECK ===
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (otp.length < 4) {
      setError('Please enter a valid OTP');
      return;
    }
    
    setIsLoading(true);
    try {
      // 1. Verify OTP
      const result = await (window as any).confirmationResult.confirm(otp);
      const user = result.user;

      // 2. Check Database for Admin Role
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const role = userSnap.data().role;
        if (role === 'admin' || role === 'super_admin') {
          // If Admin, go to dashboard
          window.location.href = '/admin/dashboard'; 
        } else {
          // Normal user, go to home or previous page
          window.location.href = from;
        }
      } else {
        // 3. New User Registration
        await setDoc(userRef, {
          phone: user.phoneNumber,
          role: 'customer',
          createdAt: new Date()
        });
        window.location.href = from;
      }
    } catch (err: any) {
      console.error(err);
      setError('Verification failed. Invalid OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setStep('options');
    setError('');
  };

  return (
    <div className="w-full max-w-[400px] mx-auto px-6">
      
      {/* RECAPTCHA CONTAINER (Invisible, but required) */}
      <div id="recaptcha-container"></div>

      <div className="text-center space-y-3 mb-10">
        <h1 className="text-3xl font-display tracking-tight">
          {mode === 'signin' ? 'Welcome Back' : 'Create Account'}
        </h1>
        <p className="font-sans text-sm text-brand-secondary">
          Secure access to your Laxardo account
        </p>
      </div>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-4 bg-red-50 border border-red-100 flex items-start gap-3 text-red-800 text-xs font-sans rounded-sm"
        >
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">{error}</p>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {step === 'options' && (
          <motion.div 
            key="options"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-4"
          >
            <button 
              type="button" 
              onClick={() => setStep('phone')}
              disabled={isLoading}
              className="btn-outline w-full flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <Phone size={16} />
              Continue with Mobile Number
            </button>

            <button 
              type="button" 
              onClick={() => setStep('email')}
              disabled={isLoading}
              className="btn-outline w-full flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <Mail size={16} />
              Continue with Email
            </button>

            <p className="text-[10px] font-sans text-brand-secondary text-center pt-2">
              Secure sign-in powered by trusted providers
            </p>
          </motion.div>
        )}

        {/* ... [Email Step remains exactly the same as your code] ... */}
        {step === 'email' && (
          <motion.div
            key="email"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <button 
              onClick={() => setStep('options')}
              className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-brand-secondary hover:text-brand-black transition-colors mb-6"
            >
              <ArrowLeft size={12} /> Back to options
            </button>
            
            <form onSubmit={handleEmailSubmit} className="space-y-5">
               {/* ... Email Form Inputs (kept from original) ... */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary">
                  Email Address
                </label>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent border-b border-brand-divider px-0 py-3 font-sans text-sm focus:outline-none focus:border-brand-black transition-all"
                  placeholder="contact@laxardo.com"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary">
                  Password
                </label>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent border-b border-brand-divider px-0 py-3 font-sans text-sm focus:outline-none focus:border-brand-black transition-all"
                  placeholder="••••••••"
                />
              </div>

              <button type="submit" disabled={isLoading} className="btn-primary w-full py-4 flex items-center justify-center gap-3 disabled:opacity-50 mt-6 rounded-full bg-black text-white">
                {isLoading ? 'PROCESSING...' : 'SIGN IN'} <ArrowRight size={16} />
              </button>
            </form>
          </motion.div>
        )}

        {step === 'phone' && (
          <motion.div
            key="phone"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <button 
              onClick={() => setStep('options')}
              className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-brand-secondary hover:text-brand-black transition-colors mb-6"
            >
              <ArrowLeft size={12} /> Back to options
            </button>
            
            <form onSubmit={handlePhoneSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary">
                  Mobile Number
                </label>
                <input 
                  type="tel" 
                  required
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (fieldErrors.phone) setFieldErrors({...fieldErrors, phone: undefined});
                  }}
                  className={`w-full bg-transparent border-b ${fieldErrors.phone ? 'border-red-500' : 'border-brand-divider'} px-0 py-3 font-sans text-sm focus:outline-none focus:border-brand-black transition-all`}
                  placeholder="9999999999"
                />
                {fieldErrors.phone && (
                  <p className="text-[10px] text-red-600 font-sans mt-1">{fieldErrors.phone}</p>
                )}
              </div>

              <p className="text-[10px] font-sans text-brand-secondary leading-relaxed pt-2">
                We'll send you a one-time verification code via SMS. (Use Test Numbers for now)
              </p>

              <button type="submit" disabled={isLoading} className="btn-primary w-full py-4 flex items-center justify-center gap-3 disabled:opacity-50 mt-6 rounded-full bg-black text-white">
                {isLoading ? 'SENDING...' : 'CONTINUE'} <ArrowRight size={16} />
              </button>
            </form>
          </motion.div>
        )}

        {step === 'phone-otp' && (
          <motion.div
            key="phone-otp"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <button 
              onClick={() => setStep('phone')}
              className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-brand-secondary hover:text-brand-black transition-colors mb-6"
            >
              <ArrowLeft size={12} /> Back to phone
            </button>
            
            <form onSubmit={handleOtpSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary">
                  Verification Code
                </label>
                <p className="text-xs font-sans text-brand-secondary mb-4">
                  Sent to {phone}
                </p>
                <input 
                  type="text" 
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-transparent border-b border-brand-divider px-0 py-3 font-sans text-2xl tracking-[0.5em] text-center focus:outline-none focus:border-brand-black transition-all"
                  placeholder="••••••"
                />
              </div>

              <button type="submit" disabled={isLoading || otp.length < 4} className="btn-primary w-full py-4 flex items-center justify-center gap-3 disabled:opacity-50 mt-6 rounded-full bg-black text-white">
                {isLoading ? 'VERIFYING...' : 'VERIFY & CONTINUE'} <CheckCircle2 size={16} />
              </button>
              
              <div className="text-center pt-4">
                <button type="button" onClick={() => setStep('phone')} className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary hover:text-brand-black transition-colors">
                  Try Again
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {step === 'options' && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="relative flex items-center py-8">
            <div className="flex-grow border-t border-brand-divider"></div>
            <span className="flex-shrink-0 mx-4 text-[10px] uppercase tracking-widest font-bold text-brand-secondary">Or</span>
            <div className="flex-grow border-t border-brand-divider"></div>
          </div>

          <div className="text-center">
            <button 
              onClick={toggleMode}
              className="text-[11px] uppercase tracking-[0.2em] font-bold text-brand-black hover:opacity-60 transition-opacity pb-1 border-b border-brand-black"
            >
              {mode === 'signin' ? 'New to Laxardo? Create Account' : 'Already have an account? Sign In'}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
