import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Lock, Mail, KeyRound, Eye, EyeOff, ShieldAlert, ArrowRight, Clock, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { auth, db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { normalizeStaffRole, isCanonicalStaffRole, isPrivilegedEmail } from '../../utils/loomIdentity';

const MAX_FAILED_ATTEMPTS = 3;
const LOCKOUT_DURATION_MINUTES = 15;

export interface RoleLoginConfig {
  /** Display title above logo. e.g. "OWNER", "DISPATCH", "ACCOUNTS" */
  roleLabel: string;
  /** Allowed customer doc roles to enter this page. */
  allowedRoles: string[];
  /** Default redirect after success. e.g. "/owner/dashboard" */
  redirectPath: string;
  /** Unique localStorage key for lock state (avoid clobbering admin lock). */
  lockKey: string;
  /** Unique localStorage key for attempts counter. */
  attemptsKey: string;
  /** Subtitle copy. e.g. "Operations staff only" */
  tagline?: string;
  /** Where to send wrong-role users (default /backend). */
  wrongRoleRedirect?: string;
  /**
   * Common LUXARDO FLOW staff login: accept ANY canonical staff role except
   * Super Admin (who has a dedicated page), resolve identity from staff/{uid},
   * always land on /production, and hide the (inoperable) email-reset flow —
   * the staff identifiers are not real mailboxes.
   */
  common?: boolean;
}

export default function RoleLoginPage({
  roleLabel,
  allowedRoles,
  redirectPath,
  lockKey,
  attemptsKey,
  tagline = 'Authorised personnel only',
  wrongRoleRedirect = '/backend',
  common = false,
}: RoleLoginConfig) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthReady } = useAuth();

  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockTimer, setLockTimer] = useState<number>(0);

  const from = (location.state as any)?.from?.pathname || redirectPath;
  // Common staff page always lands on /production; role decides what renders.
  const successTarget = common
    ? ((location.state as any)?.from?.pathname || '/production')
    : from;

  useEffect(() => {
    if (isAuthReady && user) {
      const alreadyAllowed = common
        // Common page = ordinary staff only. Super Admin and Admin both have
        // the dedicated privileged page.
        ? (isCanonicalStaffRole(user.staffRole) && !isPrivilegedEmail(user.email))
        : allowedRoles.includes(user.role);
      if (alreadyAllowed) navigate(successTarget, { replace: true });
    }
    checkLocalLock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAuthReady, navigate, successTarget]);

  const checkLocalLock = () => {
    const lockData = localStorage.getItem(lockKey);
    if (lockData) {
      try {
        const lockedUntil = JSON.parse(lockData).lockedUntil;
        if (Date.now() < lockedUntil) {
          setIsLocked(true);
          setLockTimer(Math.ceil((lockedUntil - Date.now()) / 60000));
          return true;
        }
      } catch {}
      localStorage.removeItem(lockKey);
      localStorage.removeItem(attemptsKey);
      setIsLocked(false);
    }
    return false;
  };

  const recordLocalFailure = () => {
    const attempts = parseInt(localStorage.getItem(attemptsKey) || '0', 10) + 1;
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      const lockedUntil = Date.now() + LOCKOUT_DURATION_MINUTES * 60_000;
      localStorage.setItem(lockKey, JSON.stringify({ lockedUntil }));
      setIsLocked(true);
      setLockTimer(LOCKOUT_DURATION_MINUTES);
    } else {
      localStorage.setItem(attemptsKey, attempts.toString());
    }
  };

  const verifyRole = async (uid: string) => {
    // ── Common LUXARDO FLOW staff login ──────────────────────────────
    // Ordinary staff only. Identity/role come from staff/{uid} (the sole
    // client-readable role source on the Loom project). Super Admin and Admin
    // are turned away — they use the dedicated privileged page.
    if (common) {
      if (isPrivilegedEmail(auth.currentUser?.email)) {
        await signOut(auth);
        throw new Error('Super Admin / Admin: please sign in on the dedicated admin page.');
      }
      let staffRole: string | undefined;
      try {
        const staffDoc = await getDoc(doc(db, 'staff', uid));
        if (staffDoc.exists() && staffDoc.data()?.active !== false) {
          staffRole = normalizeStaffRole(staffDoc.data()?.role) ?? undefined;
        }
      } catch {
        // permission / network error → treated as "no identity" below
      }
      if (!staffRole) {
        await signOut(auth);
        throw new Error('This account is not a recognised LUXARDO FLOW staff member. Contact your administrator.');
      }
      return true;
    }

    // ── Dedicated per-role page (B2C) ───────────────────────────────
    // Primary source of truth is `customers/{uid}` (shared B2C AuthContext).
    let role: string | undefined;
    try {
      const userDoc = await getDoc(doc(db, 'customers', uid));
      role = userDoc.exists() ? userDoc.data()?.role?.toLowerCase() : undefined;
    } catch {
      role = undefined; // customers/{uid} not readable here → fall through to staff/{uid}
    }

    // Fallback: Loom staff whose identity lives only in `staff/{uid}`
    // (no customers mirror yet). Only triggers when the customer doc is
    // absent, so existing B2C behaviour is unchanged.
    if (!role) {
      const staffDoc = await getDoc(doc(db, 'staff', uid));
      if (staffDoc.exists() && staffDoc.data()?.active !== false) {
        role = normalizeStaffRole(staffDoc.data()?.role) ?? undefined;
      }
    }

    if (!role) {
      await signOut(auth);
      throw new Error('Account record not found. Contact support.');
    }
    if (allowedRoles.includes(role)) return true;

    // Recognised but wrong-role users get a friendly redirect
    await signOut(auth);
    if (isCanonicalStaffRole(role) || ['admin', 'super_admin'].includes(role)) {
      throw new Error(`This page is for "${roleLabel}". Your role is "${role.toUpperCase()}". Use the right portal.`);
    }
    throw new Error('Access denied: this account is not authorised for staff portal.');
  };

  const errMsg = (code: string) => {
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
        return 'Incorrect email or password.';
      case 'auth/user-not-found':
        return 'No account found.';
      case 'auth/invalid-email':
        return 'Invalid email format.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Try again later.';
      case 'auth/network-request-failed':
        return 'Network error. Check your connection.';
      case 'auth/popup-closed-by-user':
        return 'Sign-in cancelled.';
      case 'auth/popup-blocked':
        return 'Popup blocked. Allow popups and try again.';
      case 'auth/account-exists-with-different-credential':
        return 'This email already has a password login. Sign in with your email and password first, then link Google from your account.';
      default:
        return 'Authentication failed.';
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setOkMsg('');
    setLoading(true);
    try {
      if (checkLocalLock()) {
        setLoading(false);
        return;
      }
      const submitEmail = email.trim().toLowerCase();
      const cred = await signInWithEmailAndPassword(auth, submitEmail, password);
      await verifyRole(cred.user.uid);
      localStorage.removeItem(attemptsKey);
      localStorage.removeItem(lockKey);
      navigate(successTarget, { replace: true });
    } catch (err: any) {
      recordLocalFailure();
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
      if (checkLocalLock()) {
        setLoading(false);
        return;
      }
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);
      await verifyRole(cred.user.uid);
      localStorage.removeItem(attemptsKey);
      localStorage.removeItem(lockKey);
      navigate(successTarget, { replace: true });
    } catch (err: any) {
      recordLocalFailure();
      setError(err?.code ? errMsg(err.code) : (err?.message || 'Google sign-in failed.'));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setOkMsg('');
    const target = email.trim().toLowerCase();
    // The common staff page has no email-reset workflow at all — the staff
    // identifiers are not mailboxes. (This handler is only reachable from the
    // non-common per-role pages and the privileged admin page.)
    if (common) {
      setError('Ask your administrator to reset your staff password.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, target);
      setOkMsg('Password reset link sent. Check your inbox.');
      setTimeout(() => setMode('login'), 3000);
    } catch (err: any) {
      setError(err?.code ? errMsg(err.code) : (err?.message || 'Failed to send reset link.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {!common && (
          <Link to={wrongRoleRedirect} className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-black mb-6">
            <ArrowLeft size={14} /> Back to portal selection
          </Link>
        )}

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-black rounded-full mb-4 shadow-md">
            <Lock size={20} className="text-white" />
          </div>
          <h1 className="font-display text-2xl text-black tracking-[0.3em] uppercase">
            {common ? 'LUXARDO FLOW' : 'LUXARDO'}
          </h1>
          <p className="text-[10px] tracking-[0.4em] text-gray-500 mt-1">
            {common ? 'STAFF SIGN-IN' : `${roleLabel} ACCESS`}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-xl relative overflow-hidden">
          {/* Security overlay when locked */}
          {isLocked && mode === 'login' && (
            <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-6 text-center border-t-4 border-red-600">
              <Clock size={40} className="text-red-500 mb-4 animate-pulse" />
              <h3 className="font-display text-lg text-black uppercase mb-2 tracking-widest">Security Lock</h3>
              <p className="text-xs text-gray-500 mb-6 leading-relaxed">
                Multiple failed login attempts detected. This portal is temporarily locked for
                <span className="font-bold text-red-600"> {lockTimer} minutes</span>.
              </p>
              {common ? (
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Wait for the lock to clear, then try again. If you have forgotten your
                  password, ask your administrator to reset it.
                </p>
              ) : (
                <button
                  onClick={() => { setMode('reset'); setIsLocked(false); }}
                  className="w-full bg-black text-white py-3 text-xs tracking-[0.3em] uppercase hover:bg-gray-900 transition-colors flex items-center justify-center gap-2 rounded-lg"
                >
                  Reset Password
                </button>
              )}
            </div>
          )}

          <h2 className="font-display text-lg text-black text-center mb-1">
            {mode === 'login' ? 'Sign In' : 'Reset Password'}
          </h2>
          <p className="text-[10px] tracking-widest uppercase text-gray-400 text-center mb-6">{tagline}</p>

          {error && (
            <div className="bg-red-50 text-red-700 p-3 mb-4 text-xs border border-red-100 rounded-lg flex items-start gap-2">
              <ShieldAlert size={14} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {okMsg && <div className="bg-green-50 text-green-700 p-3 mb-4 text-xs border border-green-100 rounded-lg">{okMsg}</div>}

          {mode === 'login' && (
            <>
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading || isLocked}
                className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-lg py-3 text-sm text-black hover:bg-gray-50 transition-all shadow-sm disabled:opacity-50"
              >
                <svg width="16" height="16" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                Sign in with Google
              </button>

              <div className="flex items-center my-5">
                <div className="flex-1 h-px bg-gray-200"></div>
                <span className="px-3 text-[9px] tracking-[0.3em] uppercase text-gray-400">or use credentials</span>
                <div className="flex-1 h-px bg-gray-200"></div>
              </div>

              <form onSubmit={handleEmailLogin} className="space-y-4" autoComplete="off">
                <input type="text" style={{ display: 'none' }} />
                <input type="password" style={{ display: 'none' }} />

                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={`${roleLabel.toLowerCase()} email`}
                    className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-3 text-sm focus:outline-none focus:border-black"
                    required
                    autoComplete="nope"
                  />
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full border border-gray-300 rounded-lg pl-10 pr-10 py-3 text-sm focus:outline-none focus:border-black"
                    required
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black">
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={loading || isLocked}
                  className="w-full bg-black text-white rounded-lg py-3 text-xs tracking-[0.3em] uppercase hover:bg-gray-900 transition-colors flex items-center justify-center gap-2 mt-2 shadow-md disabled:opacity-50"
                >
                  {loading ? 'Verifying...' : 'Sign In'} <ArrowRight size={14} />
                </button>
                <div className="text-center pt-1">
                  {common ? (
                    <span className="text-[11px] text-gray-400 tracking-wider">
                      Forgot your password? Ask your administrator to reset it.
                    </span>
                  ) : (
                    <button type="button" onClick={() => setMode('reset')} className="text-xs text-gray-500 hover:text-black tracking-wider">Forgot password?</button>
                  )}
                </div>
              </form>
            </>
          )}

          {mode === 'reset' && (
            <form onSubmit={handleReset} className="space-y-4 relative z-20" autoComplete="off">
              <input type="text" style={{ display: 'none' }} />
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={`${roleLabel.toLowerCase()} email`}
                  className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-3 text-sm focus:outline-none focus:border-black"
                  required
                  autoComplete="nope"
                />
              </div>
              <button type="submit" disabled={loading} className="w-full bg-black text-white rounded-lg py-3 text-xs tracking-[0.3em] uppercase hover:bg-gray-900 shadow-md disabled:opacity-50">
                Send Recovery Link
              </button>
              <button type="button" onClick={() => { setMode('login'); setIsLocked(false); }} className="w-full text-xs text-gray-500 hover:text-black tracking-wider mt-2">Back to sign in</button>
            </form>
          )}
        </div>

        <p className="text-center text-[10px] tracking-[0.3em] text-gray-400 uppercase mt-6">Restricted Access</p>
      </div>
    </div>
  );
}
