import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { resolveStaffRole } from '../utils/staffAuth';
import { homeForRole } from '../utils/staffRole';

/** One login page for every back-office role (admin, owner, dispatch). */
export default function StaffLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { staffRole, isAuthReady } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    (location.state as any)?.notStaff ? 'This account does not have staff access.' : '',
  );
  const [info, setInfo] = useState('');
  const fromPath: string | undefined = (location.state as any)?.from?.pathname;

  // Already signed in as staff: go straight to the right dashboard.
  useEffect(() => {
    if (isAuthReady && staffRole) navigate(fromPath || homeForRole(staffRole), { replace: true });
  }, [isAuthReady, staffRole, fromPath, navigate]);

  const finish = async () => {
    const u = auth.currentUser;
    if (!u) return;
    const role = await resolveStaffRole(u, true);
    if (!role) {
      await signOut(auth);
      setError('This account does not have staff access. Ask the owner to give you a role.');
      return;
    }
    navigate(fromPath || homeForRole(role), { replace: true });
  };

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    setInfo('');
    try {
      await fn();
      await finish();
    } catch (e: any) {
      const code = e?.code as string | undefined;
      setError(
        code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request'
          ? ''
          : code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found'
            ? 'Wrong email or password.'
            : code === 'auth/too-many-requests'
              ? 'Too many attempts. Try again later.'
              : 'Sign-in failed. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void run(() => signInWithEmailAndPassword(auth, email.trim(), password));
  };

  const onReset = async () => {
    setError('');
    setInfo('');
    if (!email.trim()) { setError('Enter your email first.'); return; }
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch {
      /* never reveal whether the account exists */
    }
    setInfo('If this email has an account, a reset link has been sent.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F0] px-4">
      <div className="bg-white p-10 shadow-sm border border-gray-100 w-full max-w-md">
        <h1 className="font-display uppercase tracking-[0.3em] text-xl mb-2 text-center">LUXARDO FASHION</h1>
        <p className="text-xs text-gray-400 tracking-widest uppercase text-center mb-8">Staff sign in</p>

        {error && <p role="alert" className="text-red-500 text-sm mb-4 text-center">{error}</p>}
        {info && <p className="text-green-700 text-sm mb-4 text-center">{info}</p>}

        <form onSubmit={onSubmit} className="space-y-4">
          <input
            type="email"
            autoComplete="username"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-black"
          />
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-black"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-black text-white py-4 text-xs uppercase tracking-widest hover:bg-gray-800 transition-all disabled:opacity-50"
          >
            {busy ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => signInWithPopup(auth, new GoogleAuthProvider()))}
          className="w-full mt-3 border border-gray-300 py-3 text-xs uppercase tracking-widest hover:border-black transition-all disabled:opacity-50"
        >
          Continue with Google
        </button>
        <button type="button" onClick={onReset} className="w-full mt-4 text-xs text-gray-400 underline">
          Forgot password?
        </button>
      </div>
    </div>
  );
}
