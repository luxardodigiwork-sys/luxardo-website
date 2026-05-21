import React, { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Lock, Mail, ArrowRight, Eye, EyeOff, User, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { auth, db } from "../firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  updateProfile,
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

  useEffect(() => {
    if (isAuthReady && user) {
      // Role-aware redirect: admins go to admin panel, customers to account/from
      if (["admin", "super_admin"].includes(user.role)) {
        navigate("/admin/dashboard", { replace: true });
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
      case "auth/popup-closed-by-user":
        return "Google sign-in cancelled.";
      case "auth/network-request-failed":
        return "Network error. Check your connection.";
      case "auth/too-many-requests":
        return "Too many attempts. Try again later.";
      default:
        return "Something went wrong. Please try again.";
    }
  };

  async function createCustomerDoc(uid: string, data: { name?: string; email?: string }) {
    const ref = doc(db, "customers", uid);
    const snap = await getDoc(ref);
    const ADMIN_EMAILS = ["luxardodigiwork@gmail.com"];
    const isAdmin = ADMIN_EMAILS.includes((data.email || "").toLowerCase());
    if (!snap.exists()) {
      await setDoc(ref, {
        id: uid,
        name: data.name || "Customer",
        email: data.email || "",
        role: isAdmin ? "admin" : "customer",
        isPrimeMember: false,
        createdAt: serverTimestamp(),
        ...(isAdmin && {
          permissions: {
            products: true, orders: true, content: true, media: true,
            customers: true, dispatch: true, settings: true,
          },
        }),
      });
    } else if (isAdmin) {
      // Existing doc — promote to admin if not already (handles users that signed up before this fix)
      const existing = snap.data();
      if (existing.role !== "admin" && existing.role !== "super_admin") {
        await setDoc(ref, {
          role: "admin",
          permissions: {
            products: true, orders: true, content: true, media: true,
            customers: true, dispatch: true, settings: true,
          },
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
    }
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!email || !password) {
      setError("Please fill all fields.");
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    } catch (err: any) {
      setError(errorMessage(err?.code || ""));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!name || !email || !password || !confirmPassword) {
      setError("Please fill all fields.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      if (cred.user) {
        await updateProfile(cred.user, { displayName: name });
        await createCustomerDoc(cred.user.uid, { name, email });
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
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const cred = await signInWithPopup(auth, provider);
      if (cred.user) {
        await createCustomerDoc(cred.user.uid, {
          name: cred.user.displayName || "Customer",
          email: cred.user.email || "",
        });
      }
    } catch (err: any) {
      setError(errorMessage(err?.code || ""));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!email) {
      setError("Please enter your email.");
      return;
    }
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
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-10">
          <Link to="/" className="inline-block mb-6">
            <h1 className="text-3xl font-display tracking-[0.3em] text-brand-black uppercase">
              LUXARDO
            </h1>
            <p className="text-[10px] tracking-[0.4em] text-brand-secondary mt-1">FASHION • ITALY</p>
          </Link>
        </div>
        <div className="bg-white p-10 border border-brand-divider shadow-sm">
          {mode !== "reset" && (
            <div className="flex border-b border-brand-divider mb-8">
              <button
                onClick={() => { setMode("login"); setError(""); setMessage(""); }}
                className={"flex-1 py-3 text-[11px] uppercase tracking-[0.3em] font-bold transition-colors " + (mode === "login" ? "text-brand-black border-b-2 border-brand-black -mb-px" : "text-brand-secondary")}
              >
                Sign In
              </button>
              <button
                onClick={() => { setMode("signup"); setError(""); setMessage(""); }}
                className={"flex-1 py-3 text-[11px] uppercase tracking-[0.3em] font-bold transition-colors " + (mode === "signup" ? "text-brand-black border-b-2 border-brand-black -mb-px" : "text-brand-secondary")}
              >
                Create Account
              </button>
            </div>
          )}
          {mode === "reset" && (
            <div className="text-center mb-8">
              <h2 className="text-2xl font-display text-brand-black mb-2">Reset Password</h2>
              <p className="text-xs text-brand-secondary">Enter your email to receive a reset link</p>
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 mb-5 text-xs flex items-start gap-2">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {message && (
            <div className="bg-green-50 border border-green-100 text-green-700 px-4 py-3 mb-5 text-xs">
              {message}
            </div>
          )}
          {mode !== "reset" && (
            <>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-3.5 mb-5 border border-brand-divider hover:border-brand-black flex items-center justify-center gap-3 text-sm transition-colors disabled:opacity-50"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" />
                  <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" />
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
                </svg>
                <span className="font-medium text-brand-black">Continue with Google</span>
              </button>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-brand-divider"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-3 text-[10px] uppercase tracking-widest text-brand-secondary">or continue with email</span>
                </div>
              </div>
            </>
          )}
          {mode === "login" && (
            <form onSubmit={handleEmailLogin} className="space-y-5">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-brand-secondary mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-secondary" size={16} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    autoComplete="email"
                    className="w-full border border-brand-divider p-3.5 pl-12 text-sm focus:outline-none focus:border-brand-black transition-colors"
                    required
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-[10px] uppercase tracking-widest text-brand-secondary">Password</label>
                  <button type="button" onClick={() => { setMode("reset"); setError(""); }} className="text-[10px] uppercase tracking-widest text-brand-secondary hover:text-brand-black">
                    Forgot?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-secondary" size={16} />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full border border-brand-divider p-3.5 pl-12 pr-12 text-sm focus:outline-none focus:border-brand-black transition-colors"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-secondary hover:text-brand-black">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-brand-black text-white text-[11px] uppercase tracking-[0.3em] font-bold hover:bg-brand-black/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {loading ? "Signing in..." : "Sign In"} {!loading && <ArrowRight size={14} />}
              </button>
            </form>
          )}
          {mode === "signup" && (
            <form onSubmit={handleEmailSignUp} className="space-y-5">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-brand-secondary mb-2">Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-secondary" size={16} />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                    className="w-full border border-brand-divider p-3.5 pl-12 text-sm focus:outline-none focus:border-brand-black transition-colors"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-brand-secondary mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-secondary" size={16} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    autoComplete="email"
                    className="w-full border border-brand-divider p-3.5 pl-12 text-sm focus:outline-none focus:border-brand-black transition-colors"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-brand-secondary mb-2">Password (min 6 chars)</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-secondary" size={16} />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="w-full border border-brand-divider p-3.5 pl-12 pr-12 text-sm focus:outline-none focus:border-brand-black transition-colors"
                    required
                    minLength={6}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-secondary hover:text-brand-black">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-brand-secondary mb-2">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-secondary" size={16} />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="w-full border border-brand-divider p-3.5 pl-12 text-sm focus:outline-none focus:border-brand-black transition-colors"
                    required
                  />
                </div>
              </div>
              <p className="text-[10px] text-brand-secondary leading-relaxed">
                By creating an account, you agree to our <Link to="/policies/terms" className="underline hover:text-brand-black">Terms</Link> and <Link to="/policies/privacy" className="underline hover:text-brand-black">Privacy Policy</Link>.
              </p>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-brand-black text-white text-[11px] uppercase tracking-[0.3em] font-bold hover:bg-brand-black/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {loading ? "Creating..." : "Create Account"} {!loading && <ArrowRight size={14} />}
              </button>
            </form>
          )}
          {mode === "reset" && (
            <form onSubmit={handlePasswordReset} className="space-y-5">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-brand-secondary mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-secondary" size={16} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full border border-brand-divider p-3.5 pl-12 text-sm focus:outline-none focus:border-brand-black transition-colors"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-brand-black text-white text-[11px] uppercase tracking-[0.3em] font-bold hover:bg-brand-black/90 transition-colors disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
              <button
                type="button"
                onClick={() => { setMode("login"); setError(""); setMessage(""); }}
                className="w-full text-[10px] uppercase tracking-widest text-brand-secondary hover:text-brand-black"
              >
                ← Back to Sign In
              </button>
            </form>
          )}
        </div>
        <div className="text-center mt-6 text-[10px] uppercase tracking-widest text-brand-secondary">
          Need help? <Link to="/contact" className="hover:text-brand-black underline">Contact Us</Link>
        </div>
      </motion.div>
    </div>
  );
}
