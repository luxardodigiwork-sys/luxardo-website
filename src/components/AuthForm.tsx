import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, User, Phone, ArrowRight, AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type AuthMode = 'signin' | 'signup';
type AuthStep = 'options' | 'email' | 'phone' | 'phone-otp';

interface AuthFormProps {
  initialMode?: AuthMode;
}

export function AuthForm({ initialMode = 'signin' }: AuthFormProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [step, setStep] = useState<AuthStep>('options');
  
  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{email?: string, password?: string, phone?: string}>({});
  
  const { login, register, socialLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/account';

  useEffect(() => {
    setMode(initialMode);
    setStep('options');
    setError('');
    setFieldErrors({});
  }, [initialMode]);

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    setError('');
    setIsLoading(true);
    try {
      await socialLogin(provider);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    } finally {
      setIsLoading(false);
    }
  };

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

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!phone || phone.length < 7) {
      setFieldErrors({ phone: 'Please enter a valid phone number' });
      return;
    }
    
    setIsLoading(true);
    // Simulate sending OTP
    setTimeout(() => {
      setIsLoading(false);
      setStep('phone-otp');
    }, 1000);
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (otp.length < 4) {
      setError('Please enter a valid OTP');
      return;
    }
    
    setIsLoading(true);
    // Simulate OTP verification and login
    setTimeout(async () => {
      try {
        // Mock login for phone auth since it's not fully implemented in AuthContext
        // We'll just use a dummy email based on phone to satisfy the existing context
        const dummyEmail = `${phone.replace(/[^0-9]/g, '')}@phone-auth.luxardo.com`;
        
        if (mode === 'signin') {
          // Try to login, if fails, we should probably register, but for mock we'll just show error
          try {
            await login(dummyEmail, 'phone-auth-dummy-pass');
            navigate(from, { replace: true });
          } catch (err) {
            // If user doesn't exist, auto-register for seamless experience
            await register({ name: 'Mobile User', email: dummyEmail, phone, password: 'phone-auth-dummy-pass' });
            navigate(from, { replace: true });
          }
        } else {
          await register({ name: name || 'Mobile User', email: dummyEmail, phone, password: 'phone-auth-dummy-pass' });
          navigate(from, { replace: true });
        }
      } catch (err: any) {
        setError(err.message || 'Verification failed');
        setIsLoading(false);
      }
    }, 1500);
  };

  const toggleMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setStep('options');
    setError('');
  };

  return (
    <div className="w-full max-w-[400px] mx-auto px-6">
      <div className="text-center space-y-3 mb-10">
        <h1 className="text-3xl font-display tracking-tight">
          {mode === 'signin' ? 'Welcome Back' : 'Create Account'}
        </h1>
        <p className="font-sans text-sm text-brand-secondary">
          Secure access to your Luxardo account
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
              {mode === 'signup' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary">
                    Full Name
                  </label>
                  <input 
                    type="text" 
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-transparent border-b border-brand-divider px-0 py-3 font-sans text-sm focus:outline-none focus:border-brand-black transition-all"
                    placeholder="Alexander Wright"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary">
                  Email Address
                </label>
                <input 
                  type="text" 
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors({...fieldErrors, email: undefined});
                  }}
                  className={`w-full bg-transparent border-b ${fieldErrors.email ? 'border-red-500' : 'border-brand-divider'} px-0 py-3 font-sans text-sm focus:outline-none focus:border-brand-black transition-all`}
                  placeholder="alexander@luxury.com"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary">
                    Password
                  </label>
                  {mode === 'signin' && (
                    <Link to="/forgot-password" title="Forgot Password" className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary hover:text-brand-black transition-colors">
                      Forgot?
                    </Link>
                  )}
                </div>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) setFieldErrors({...fieldErrors, password: undefined});
                    }}
                    className={`w-full bg-transparent border-b ${fieldErrors.password ? 'border-red-500' : 'border-brand-divider'} px-0 py-3 pr-10 font-sans text-sm focus:outline-none focus:border-brand-black transition-all`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 text-brand-secondary hover:text-brand-black transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="text-[10px] text-red-600 font-sans mt-1">{fieldErrors.password}</p>
                )}
              </div>

              <button type="submit" disabled={isLoading} className="btn-primary w-full py-4 flex items-center justify-center gap-3 disabled:opacity-50 mt-6 rounded-full">
                {isLoading ? 'PROCESSING...' : (mode === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT')} <ArrowRight size={16} />
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
              {mode === 'signup' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary">
                    Full Name
                  </label>
                  <input 
                    type="text" 
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-transparent border-b border-brand-divider px-0 py-3 font-sans text-sm focus:outline-none focus:border-brand-black transition-all"
                    placeholder="Alexander Wright"
                  />
                </div>
              )}

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
                  placeholder="+1 (555) 000-0000"
                />
                {fieldErrors.phone && (
                  <p className="text-[10px] text-red-600 font-sans mt-1">{fieldErrors.phone}</p>
                )}
              </div>

              <p className="text-[10px] font-sans text-brand-secondary leading-relaxed pt-2">
                We'll send you a one-time verification code via SMS.
              </p>

              <button type="submit" disabled={isLoading} className="btn-primary w-full py-4 flex items-center justify-center gap-3 disabled:opacity-50 mt-6 rounded-full">
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

              <button type="submit" disabled={isLoading || otp.length < 4} className="btn-primary w-full py-4 flex items-center justify-center gap-3 disabled:opacity-50 mt-6 rounded-full">
                {isLoading ? 'VERIFYING...' : 'VERIFY & CONTINUE'} <CheckCircle2 size={16} />
              </button>
              
              <div className="text-center pt-4">
                <button type="button" className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary hover:text-brand-black transition-colors">
                  Resend Code
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
              {mode === 'signin' ? 'New to Luxardo? Create Account' : 'Already have an account? Sign In'}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
