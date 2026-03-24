import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, User, Phone, ArrowRight, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{email?: string, password?: string, confirmPassword?: string}>({});
  const [isLoading, setIsLoading] = useState(false);
  const { register, socialLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/account';

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const validateForm = () => {
    const errors: {email?: string, password?: string, confirmPassword?: string} = {};
    let isValid = true;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.email = 'Please enter a valid email address';
      isValid = false;
    }

    if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
      isValid = false;
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
      isValid = false;
    }

    setFieldErrors(errors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    try {
      await register({ name, email, phone, password });
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setIsLoading(false);
    }
  };

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

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-screen bg-brand-bg pt-32 pb-20"
    >
      <div className="max-w-md mx-auto px-6">
        <div className="text-center space-y-4 mb-12">
          <h1 className="text-4xl font-display">Create Account</h1>
          <p className="font-sans text-brand-secondary">Join the world of Luxardo</p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-8 p-4 bg-red-50 border border-red-100 flex items-center gap-3 text-red-800 text-sm font-sans"
          >
            <AlertCircle size={16} className="flex-shrink-0" />
            <p>{error}</p>
          </motion.div>
        )}

        <div className="space-y-4 mb-8">
          <button 
            type="button" 
            onClick={() => handleSocialLogin('apple')}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 bg-brand-black text-brand-white px-4 py-4 text-[11px] uppercase tracking-widest font-bold hover:bg-brand-secondary transition-colors disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M16.365 21.444c-1.343 1.14-2.776 1.155-3.961.162-1.558-1.305-3.287-1.269-4.804.054-1.11.966-2.453.996-3.649-.12-3.114-2.91-5.875-8.415-3.045-13.185C2.51 5.628 4.62 4.02 6.85 4.02c1.47 0 2.82.66 3.96 1.2 1.02.48 2.07.72 3.12.72 1.23 0 2.46-.33 3.63-.99 1.29-.72 2.73-1.05 4.14-.99 2.04.09 3.84.93 5.07 2.43-4.14 2.4-3.3 8.28.93 10.05-1.23 3.15-3.36 6.15-5.335 7.994zM15.45 2.58c-.9.99-2.22 1.62-3.54 1.59-.18-1.44.42-2.85 1.35-3.84.9-.99 2.22-1.62 3.54-1.59.18 1.44-.42 2.85-1.35 3.84z"/>
            </svg>
            Continue with Apple
          </button>
          <button 
            type="button" 
            onClick={() => handleSocialLogin('google')}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 bg-brand-white text-brand-black border border-brand-divider px-4 py-4 text-[11px] uppercase tracking-widest font-bold hover:border-brand-black hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>
        </div>

        <div className="relative flex items-center py-4 mb-8">
          <div className="flex-grow border-t border-brand-divider"></div>
          <span className="flex-shrink-0 mx-4 text-[10px] uppercase tracking-widest font-bold text-brand-secondary">Or</span>
          <div className="flex-grow border-t border-brand-divider"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary flex items-center gap-2">
              <User size={12} /> Full Name
            </label>
            <input 
              type="text" 
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-brand-white border border-brand-divider px-4 py-4 font-sans focus:outline-none focus:border-brand-black focus:ring-1 focus:ring-brand-black transition-all"
              placeholder="Alexander Wright"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary flex items-center gap-2">
              <Mail size={12} /> Email Address
            </label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors({...fieldErrors, email: undefined});
              }}
              className={`w-full bg-brand-white border ${fieldErrors.email ? 'border-red-500' : 'border-brand-divider'} px-4 py-4 font-sans focus:outline-none focus:border-brand-black focus:ring-1 focus:ring-brand-black transition-all`}
              placeholder="alexander@luxury.com"
            />
            {fieldErrors.email && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-red-600 font-sans mt-1">
                {fieldErrors.email}
              </motion.p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary flex items-center gap-2">
              <Phone size={12} /> Phone Number
            </label>
            <input 
              type="tel" 
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-brand-white border border-brand-divider px-4 py-4 font-sans focus:outline-none focus:border-brand-black focus:ring-1 focus:ring-brand-black transition-all"
              placeholder="+1 (555) 000-0000"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary flex items-center gap-2">
              <Lock size={12} /> Password
            </label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors({...fieldErrors, password: undefined});
              }}
              className={`w-full bg-brand-white border ${fieldErrors.password ? 'border-red-500' : 'border-brand-divider'} px-4 py-4 font-sans focus:outline-none focus:border-brand-black focus:ring-1 focus:ring-brand-black transition-all`}
              placeholder="••••••••"
            />
            {fieldErrors.password && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-red-600 font-sans mt-1">
                {fieldErrors.password}
              </motion.p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary flex items-center gap-2">
              <Lock size={12} /> Confirm Password
            </label>
            <input 
              type="password" 
              required
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (fieldErrors.confirmPassword) setFieldErrors({...fieldErrors, confirmPassword: undefined});
              }}
              className={`w-full bg-brand-white border ${fieldErrors.confirmPassword ? 'border-red-500' : 'border-brand-divider'} px-4 py-4 font-sans focus:outline-none focus:border-brand-black focus:ring-1 focus:ring-brand-black transition-all`}
              placeholder="••••••••"
            />
            {fieldErrors.confirmPassword && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-red-600 font-sans mt-1">
                {fieldErrors.confirmPassword}
              </motion.p>
            )}
          </div>

          <p className="text-[10px] font-sans text-brand-secondary leading-relaxed pt-2">
            By creating an account, you agree to our <Link to="/policies/terms" className="underline hover:text-brand-black transition-colors">Terms & Conditions</Link> and <Link to="/policies/privacy" className="underline hover:text-brand-black transition-colors">Privacy Policy</Link>.
          </p>

          <button type="submit" disabled={isLoading} className="btn-primary w-full py-5 flex items-center justify-center gap-4 disabled:opacity-50 mt-4">
            {isLoading ? 'REGISTERING...' : 'REGISTER'} <ArrowRight size={18} />
          </button>
        </form>

        <div className="mt-12 pt-8 border-t border-brand-divider text-center space-y-6">
          <p className="text-sm font-sans text-brand-secondary">Already have an account?</p>
          <Link to="/login" state={{ from: location.state?.from }} className="text-[11px] uppercase tracking-[0.25em] font-bold text-brand-black hover:opacity-60 transition-opacity">
            Login
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
