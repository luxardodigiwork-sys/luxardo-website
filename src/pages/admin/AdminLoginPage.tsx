import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, KeyRound, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { signInWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { auth } from '../../firebase';

const ALLOWED_ADMIN_EMAIL = 'luxardodigiwork@gmail.com';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [step, setStep] = useState<'login' | 'request_reset'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const { user, isAuthReady } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthReady && user && ['super_admin', 'admin'].includes(user.role)
        && user.email?.toLowerCase() === ALLOWED_ADMIN_EMAIL.toLowerCase()) {
      navigate('/admin/dashboard');
    }
  }, [user, isAuthReady, navigate]);

  const errMsg = (code: string) => {
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password': return 'Incorrect Password. Please try again.';
      case 'auth/user-not-found': return 'User Not Found. Please check your email.';
      case 'auth/invalid-email': return 'Invalid email format.';
      case 'auth/user-disabled': return 'This account has been disabled.';
      case 'auth/too-many-requests': return 'Too many failed attempts. Try again later.';
      case 'auth/network-request-failed': return 'Network error. Check your connection.';
      default: return 'Authentication failed. Please try again.';
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setMessage('');
    const submitEmail = email.trim().toLowerCase();
    if (submitEmail !== ALLOWED_ADMIN_EMAIL.toLowerCase()) {
      setError('Access Denied: Unauthorized Admin Email.');
      return;
    }
    setIsLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, submitEmail, password);
      if (cred.user.email?.toLowerCase() !== ALLOWED_ADMIN_EMAIL.toLowerCase()) {
        await signOut(auth);
        setError('Access Denied: Unauthorized Admin Email.');
        setIsLoading(false);
        return;
      }
      navigate('/admin/dashboard');
    } catch (err: any) {
      setError(errMsg(err?.code || ''));
    } finally { setIsLoading(false); }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setMessage('');
    const submitEmail = email.trim().toLowerCase();
    if (!submitEmail) { setError('Please enter your admin email.'); return; }
    if (submitEmail !== ALLOWED_ADMIN_EMAIL.toLowerCase()) {
      setError('Access Denied: Unauthorized Admin Email.');
      return;
    }
    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, submitEmail);
      setMessage('Password reset link sent to your email.');
      setTimeout(() => setStep('login'), 3000);
    } catch (err: any) {
      setError(errMsg(err?.code || ''));
    } finally { setIsLoading(false); }
  };

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white p-10 border border-brand-divider shadow-sm">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-bg rounded-full mb-6">
            <Lock size={24} className="text-brand-black" />
          </div>
          <h1 className="text-3xl font-display mb-2 uppercase tracking-widest">LUXARDO FASHION Admin</h1>
          <p className="text-brand-secondary text-sm">
            {step === 'login' ? 'Enter your credentials to access the panel' : 'Recover your master access'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 mb-6 text-sm border border-red-100 flex items-start gap-2">
            <ShieldAlert size={16} className="mt-0.5 flex-shrink-0" /><span>{error}</span>
          </div>
        )}
        {message && <div className="bg-green-50 text-green-700 p-4 mb-6 text-sm border border-green-100">{message}</div>}

        {step === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-xs uppercase tracking-wider text-brand-secondary">Admin Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-secondary" size={16} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-brand-divider p-4 pl-12 focus:outline-none focus:border-brand-black"
                  placeholder="admin@example.com" required autoComplete="email" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="block text-xs uppercase tracking-wider text-brand-secondary">Password</label>
                <button type="button" onClick={() => { setStep('request_reset'); setError(''); }}
                  className="text-xs text-brand-secondary hover:text-brand-black">Forgot Password?</button>
              </div>
              <div className="relative">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-secondary" size={16} />
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-brand-divider p-4 pl-12 pr-12 focus:outline-none focus:border-brand-black"
                  placeholder="••••••••" required autoComplete="current-password" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-secondary hover:text-brand-black">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={isLoading} className="w-full btn-primary py-4 flex items-center justify-center gap-3">
              {isLoading ? 'AUTHENTICATING...' : 'ACCESS DASHBOARD'} <ArrowRight size={18} />
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-xs uppercase tracking-wider text-brand-secondary">Admin Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-secondary" size={16} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-brand-divider p-4 pl-12 focus:outline-none focus:border-brand-black"
                  placeholder="admin@example.com" required autoComplete="email" />
              </div>
            </div>
            <button type="submit" disabled={isLoading} className="w-full btn-primary py-4 flex items-center justify-center gap-3">
              {isLoading ? 'SENDING...' : 'SEND RECOVERY EMAIL'} <ArrowRight size={18} />
            </button>
            <button type="button" onClick={() => { setStep('login'); setError(''); setMessage(''); }}
              className="w-full py-4 text-sm text-brand-secondary hover:text-brand-black">Back to Login</button>
          </form>
        )}
      </div>
    </div>
  );
}
