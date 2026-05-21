import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, KeyRound, Eye, EyeOff, ShieldAlert, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { auth } from '../../firebase';

const ALLOWED_ADMIN_EMAIL = 'luxardodigiwork@gmail.com';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { user, isAuthReady } = useAuth();

  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // If already signed in as admin, go straight to dashboard
  useEffect(() => {
    if (
      isAuthReady &&
      user &&
      ['admin', 'super_admin'].includes(user.role) &&
      user.email?.toLowerCase() === ALLOWED_ADMIN_EMAIL.toLowerCase()
    ) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [user, isAuthReady, navigate]);

  const errMsg = (code: string) => {
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
        return 'Incorrect password.';
      case 'auth/user-not-found':
        return 'No admin account found.';
      case 'auth/invalid-email':
        return 'Invalid email format.';
      case 'auth/user-disabled':
        return 'This admin account has been disabled.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Try again in a few minutes.';
      case 'auth/network-request-failed':
        return 'Network error. Check your connection.';
      case 'auth/popup-closed-by-user':
        return 'Google sign-in cancelled.';
      case 'auth/popup-blocked':
        return 'Popup blocked. Allow popups for this site and try again.';
      default:
        return 'Authentication failed. Please try again.';
    }
  };

  const verifyAdminEmail = async (signedInEmail: string | null | undefined) => {
    if (signedInEmail?.toLowerCase() !== ALLOWED_ADMIN_EMAIL.toLowerCase()) {
      await signOut(auth);
      throw new Error('Access denied: this email is not authorised for admin.');
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setOkMsg('');
    const submitEmail = email.trim().toLowerCase();
    if (submitEmail !== ALLOWED_ADMIN_EMAIL.toLowerCase()) {
      setError('Access denied: unauthorised admin email.');
      return;
    }
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, submitEmail, password);
      await verifyAdminEmail(cred.user.email);
      navigate('/admin/dashboard', { replace: true });
    } catch (err: any) {
      setError(err?.code ? errMsg(err.code) : (err?.message || 'Authentication failed.'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setOkMsg('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);
      await verifyAdminEmail(cred.user.email);
      navigate('/admin/dashboard', { replace: true });
    } catch (err: any) {
      setError(err?.code ? errMsg(err.code) : (err?.message || 'Google sign-in failed.'));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setOkMsg('');
    const submitEmail = email.trim().toLowerCase();
    if (submitEmail !== ALLOWED_ADMIN_EMAIL.toLowerCase()) {
      setError('Access denied: unauthorised admin email.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, submitEmail);
      setOkMsg('Password reset link sent. Check your inbox.');
      setTimeout(() => setMode('login'), 3000);
    } catch (err: any) {
      setError(err?.code ? errMsg(err.code) : (err?.message || 'Failed to send reset link.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-black rounded-full mb-4">
            <Lock size={20} className="text-white" />
          </div>
          <h1 className="font-display text-2xl text-brand-black tracking-[0.3em] uppercase">LUXARDO</h1>
          <p className="text-[10px] tracking-[0.4em] text-brand-secondary mt-1">ADMIN ACCESS</p>
        </div>

        <div className="bg-white border border-brand-divider p-8 shadow-sm">
          <h2 className="font-display text-lg text-brand-black text-center mb-1">
            {mode === 'login' ? 'Sign In' : 'Reset Password'}
          </h2>
          <p className="text-[10px] tracking-widest uppercase text-brand-secondary text-center mb-6">
            {mode === 'login' ? 'Authorised personnel only' : 'Send recovery link'}
          </p>

          {error && (
            <div className="bg-red-50 text-red-700 p-3 mb-4 text-xs border border-red-100 flex items-start gap-2">
              <ShieldAlert size={14} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {okMsg && (
            <div className="bg-green-50 text-green-700 p-3 mb-4 text-xs border border-green-100">
              {okMsg}
            </div>
          )}

          {mode === 'login' && (
            <>
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 border border-brand-divider py-3 text-sm text-brand-black hover:bg-brand-bg transition-colors disabled:opacity-50 mb-4"
              >
                <svg width="16" height="16" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                Sign in with Google
              </button>

              <div className="flex items-center my-4">
                <div className="flex-1 h-px bg-brand-divider"></div>
                <span className="px-3 text-[9px] tracking-[0.3em] uppercase text-brand-secondary">or</span>
                <div className="flex-1 h-px bg-brand-divider"></div>
              </div>

              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-secondary" size={14} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Admin email"
                    className="w-full border border-brand-divider pl-10 pr-3 py-3 text-sm focus:outline-none focus:border-brand-black"
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-secondary" size={14} />
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full border border-brand-divider pl-10 pr-10 py-3 text-sm focus:outline-none focus:border-brand-black"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-secondary hover:text-brand-black"
                  >
                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brand-black text-white py-3 text-xs tracking-[0.3em] uppercase hover:bg-brand-black/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? 'Signing in…' : 'Sign In'}
                  {!loading && <ArrowRight size={14} />}
                </button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => { setMode('reset'); setError(''); setOkMsg(''); }}
                    className="text-xs text-brand-secondary hover:text-brand-black tracking-wider"
                  >
                    Forgot password?
                  </button>
                </div>
              </form>
            </>
          )}

          {mode === 'reset' && (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-secondary" size={14} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Admin email"
                  className="w-full border border-brand-divider pl-10 pr-3 py-3 text-sm focus:outline-none focus:border-brand-black"
                  required
                  autoComplete="email"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-black text-white py-3 text-xs tracking-[0.3em] uppercase hover:bg-brand-black/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? 'Sending…' : 'Send Recovery Link'}
                {!loading && <ArrowRight size={14} />}
              </button>
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setOkMsg(''); }}
                className="w-full text-xs text-brand-secondary hover:text-brand-black tracking-wider"
              >
                Back to sign in
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-[10px] tracking-[0.3em] text-brand-secondary uppercase mt-6">
          Restricted Access
        </p>
      </div>
    </div>
  );
}
