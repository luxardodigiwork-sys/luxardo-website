import React, { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Lock, Mail, ArrowRight, Eye, EyeOff, User, AlertCircle, Clock } from "lucide-react";

const MAX_FAILED_ATTEMPTS = 3;
const LOCKOUT_DURATION_MINUTES = 15;
const LOCK_KEY = "customer_lock";
const ATTEMPTS_KEY = "customer_attempts";
import { motion } from "framer-motion";
import { auth, db } from "../firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  updateProfile,
  signOut
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";

type Mode = "login" | "signup" | "reset";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthReady } = useAuth();
  const from = (location.state as any)?.from?.pathname || "/account";

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockTimer, setLockTimer] = useState<number>(0);

  // 3-attempt lockout helpers
  const checkLocalLock = () => {
    const lockData = localStorage.getItem(LOCK_KEY);
    if (lockData) {
      try {
        const lockedUntil = JSON.parse(lockData).lockedUntil;
        if (Date.now() < lockedUntil) {
          setIsLocked(true);
          setLockTimer(Math.ceil((lockedUntil - Date.now()) / 60000));
          return true;
        }
      } catch {}
      localStorage.removeItem(LOCK_KEY);
      localStorage.removeItem(ATTEMPTS_KEY);
      setIsLocked(false);
    }
    return false;
  };

  const recordLocalFailure = () => {
    const attempts = parseInt(localStorage.getItem(ATTEMPTS_KEY) || "0", 10) + 1;
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      const lockedUntil = Date.now() + LOCKOUT_DURATION_MINUTES * 60_000;
      localStorage.setItem(LOCK_KEY, JSON.stringify({ lockedUntil }));
      setIsLocked(true);
      setLockTimer(LOCKOUT_DURATION_MINUTES);
    } else {
      localStorage.setItem(ATTEMPTS_KEY, attempts.toString());
    }
  };

  const clearLockState = () => {
    localStorage.removeItem(LOCK_KEY);
    localStorage.removeItem(ATTEMPTS_KEY);
    setIsLocked(false);
  };

  // Check lock on mount and on mode change
  useEffect(() => {
    checkLocalLock();
  }, [mode]);

  useEffect(() => {
    if (isAuthReady && user) {
      if (["admin", "super_admin"].includes(user.role)) {
        navigate("/admin/login", { replace: true });
      } else if (["dispatch", "accounts", "owner"].includes(user.role)) {
        navigate("/backend", { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    }
  }, [user, isAuthReady, navigate, from]);

  const errorMessage = (code: string): string => {
    switch (code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
        return "Incorrect email or password.";
      case "auth/user-not-found":
        return "No account found with this email.";
      case "auth/email-already-in-use":
        return "An account already exists with this email.";
      case "auth/weak-password":
        return "Password must be at least 6 characters.";
      case "auth/invalid-email":
        return "Invalid email format.";
      default:
        return "Authentication failed. Please try again.";
    }
  };

  async function createCustomerDoc(uid: string, data: { name?: string; email?: string }) {
    const ref = doc(db, "customers", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: uid,
        name: data.name || "Customer",
        email: data.email || "",
        role: "customer",
        isPrimeMember: false,
        createdAt: serverTimestamp(),
      });
    }
  }

  const preventStaffLogin = async (uid: string) => {
    const userDocRef = doc(db, 'users', uid);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      const role = userDocSnap.data()?.role?.toLowerCase();
      if (['admin', 'super_admin'].includes(role)) {
        await signOut(auth);
        setError("Admins must sign in via the Admin portal.");
        setTimeout(() => navigate("/admin/login"), 1500);
        throw new Error('Redirecting to Admin Portal');
      } else if (['dispatch', 'accounts', 'owner'].includes(role)) {
        await signOut(auth);
        setError("Staff must sign in via the Backend Gateway.");
        setTimeout(() => navigate("/backend"), 1500);
        throw new Error('Redirecting to Backend Gateway');
      }
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (checkLocalLock()) return;
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      await preventStaffLogin(cred.user.uid);
      // Success — clear any prior failure counters
      clearLockState();
    } catch (err: any) {
      if (!err.message?.includes('Redirecting')) {
        recordLocalFailure();
        setError(errorMessage(err?.code || ""));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      if (cred.user) {
        await updateProfile(cred.user, { displayName: name });
        await createCustomerDoc(cred.user.uid, { name, email: email.trim().toLowerCase() });
      }
    } catch (err: any) {
      setError(errorMessage(err?.code || ""));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setMessage("");
    if (checkLocalLock()) return;
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const cred = await signInWithPopup(auth, provider);
      await preventStaffLogin(cred.user.uid);
      if (cred.user) {
        await createCustomerDoc(cred.user.uid, {
          name: cred.user.displayName || "Customer",
          email: cred.user.email || "",
        });
        clearLockState();
      }
    } catch (err: any) {
      if (!err.message?.includes('Redirecting')) {
        // Only count "auth/invalid-credential" type failures, not user cancels
        if (err?.code && !["auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(err.code)) {
          recordLocalFailure();
        }
        setError(errorMessage(err?.code || ""));
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      setMessage("Password reset link sent. Check your inbox.");
      setTimeout(() => setMode("login"), 3000);
    } catch (err: any) {
      setError(errorMessage(err?.code || ""));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 py-16">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-4">
            <h1 className="text-3xl font-display tracking-[0.3em] text-black uppercase">LUXARDO</h1>
            <p className="text-[10px] tracking-[0.4em] text-gray-500 mt-1">FASHION • ITALY</p>
          </Link>
        </div>

        <div className="bg-white p-8 border border-gray-200 rounded-2xl shadow-xl relative overflow-hidden">
          {/* Security overlay when locked */}
          {isLocked && mode !== "reset" && (
            <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-6 text-center border-t-4 border-red-600 rounded-2xl">
              <Clock size={40} className="text-red-500 mb-4 animate-pulse" />
              <h3 className="font-display text-lg text-black uppercase mb-2 tracking-widest">Security Lock</h3>
              <p className="text-xs text-gray-500 mb-6 leading-relaxed">
                Too many failed sign-in attempts. Account temporarily locked for
                <span className="font-bold text-red-600"> {lockTimer} minutes</span>.
              </p>
              <button
                onClick={() => { setMode("reset"); setIsLocked(false); }}
                className="w-full bg-black text-white py-3 text-xs tracking-[0.3em] uppercase hover:bg-gray-900 transition-colors flex items-center justify-center gap-2 rounded-lg"
              >
                Reset Password Instead
              </button>
            </div>
          )}

          {mode !== "reset" && (
            <div className="flex border-b border-gray-200 mb-6">
              <button onClick={() => { setMode("login"); setError(""); setMessage(""); }} className={"flex-1 pb-3 text-[11px] uppercase tracking-[0.3em] font-bold " + (mode === "login" ? "text-black border-b-2 border-black" : "text-gray-400")}>Sign In</button>
              <button onClick={() => { setMode("signup"); setError(""); setMessage(""); }} className={"flex-1 pb-3 text-[11px] uppercase tracking-[0.3em] font-bold " + (mode === "signup" ? "text-black border-b-2 border-black" : "text-gray-400")}>Create Account</button>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 mb-4 text-xs flex items-start gap-2 rounded-lg">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {message && <div className="bg-green-50 border border-green-100 text-green-700 px-4 py-3 mb-4 text-xs rounded-lg">{message}</div>}

          {mode !== "reset" && (
            <>
              <button type="button" onClick={handleGoogleSignIn} disabled={loading} className="w-full py-3 mb-5 border border-gray-200 rounded-lg flex items-center justify-center gap-3 text-sm hover:bg-gray-50 transition-colors disabled:opacity-50">
                <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" />
                  <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" />
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
                </svg>
                <span className="font-medium text-black">Continue with Google</span>
              </button>
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
                <div className="relative flex justify-center"><span className="bg-white px-3 text-[10px] uppercase tracking-widest text-gray-400">or use email</span></div>
              </div>
            </>
          )}

          {mode === "login" && (
            <form onSubmit={handleEmailLogin} className="space-y-4" autoComplete="off">
              {/* AUTOFILL TRAP */}
              <input type="text" style={{ display: 'none' }} />
              <input type="password" style={{ display: 'none' }} />

              <div>
                <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-1">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:border-black" required autoComplete="nope"/>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1"><label className="block text-[10px] uppercase tracking-widest text-gray-500">Password</label>
                  <button type="button" onClick={() => { setMode("reset"); setError(""); }} className="text-[10px] uppercase tracking-widest text-gray-400 hover:text-black">Forgot?</button>
                </div>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full border border-gray-300 rounded-lg p-3 pr-10 text-sm focus:outline-none focus:border-black" required autoComplete="new-password"/>
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full py-3.5 bg-black text-white text-[11px] uppercase tracking-[0.3em] font-bold rounded-lg hover:bg-gray-900 transition-colors flex items-center justify-center gap-2">
                {loading ? "Signing in..." : "Sign In"} <ArrowRight size={14} />
              </button>
            </form>
          )}

          {mode === "signup" && (
            <form onSubmit={handleEmailSignUp} className="space-y-4" autoComplete="off">
              {/* AUTOFILL TRAP */}
              <input type="text" style={{ display: 'none' }} />
              <input type="password" style={{ display: 'none' }} />

              <div>
                <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-1">Full Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:border-black" required autoComplete="nope" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-1">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:border-black" required autoComplete="nope" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-1">Password</label>
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:border-black" required minLength={6} autoComplete="new-password" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-1">Confirm Password</label>
                <input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:border-black" required autoComplete="new-password" />
              </div>
              <button type="submit" disabled={loading} className="w-full py-3.5 bg-black text-white text-[11px] uppercase tracking-[0.3em] font-bold rounded-lg hover:bg-gray-900 transition-colors flex items-center justify-center gap-2">
                {loading ? "Creating..." : "Create Account"} <ArrowRight size={14} />
              </button>
            </form>
          )}

          {mode === "reset" && (
            <form onSubmit={handlePasswordReset} className="space-y-4" autoComplete="off">
              {/* AUTOFILL TRAP */}
              <input type="text" style={{ display: 'none' }} />

              <div>
                <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-1">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:border-black" required autoComplete="nope" />
              </div>
              <button type="submit" className="w-full py-3.5 bg-black text-white text-[11px] uppercase tracking-[0.3em] font-bold rounded-lg hover:bg-gray-900">Send Reset Link</button>
              <button type="button" onClick={() => setMode("login")} className="w-full text-[10px] uppercase tracking-widest text-gray-400 text-center mt-2">← Back to Sign In</button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}