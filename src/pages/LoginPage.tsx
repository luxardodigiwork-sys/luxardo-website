import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  linkWithPhoneNumber,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  ConfirmationResult,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ALL_COUNTRIES } from '../countries';
import { getLoginStep, authErrorMessage } from '../utils/loginFlow';

declare global { interface Window { recaptchaVerifier?: RecaptchaVerifier; } }

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthReady, login } = useAuth();
  const fromLoc = (location.state as any)?.from;
  const from = fromLoc?.pathname ? `${fromLoc.pathname}${fromLoc.search || ''}` : '/';

  // Real auth state drives the screen (see utils/loginFlow.ts): phone verification cannot be skipped.
  const [fbUser, setFbUser] = useState<FirebaseUser | null>(auth.currentUser);
  useEffect(() => onAuthStateChanged(auth, (u) => setFbUser(u)), []);
  const flowStep = getLoginStep({ firebaseUser: fbUser, hasProfile: !!user });

  const [phase, setPhase] = useState<'enter-phone' | 'enter-otp'>('enter-phone');
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState({ firstName: '', lastName: '', email: '', gender: '', age: '' });
  const recaptchaRef = useRef<HTMLDivElement>(null);

  // Fully signed in, phone verified, profile saved: go where the customer was heading.
  useEffect(() => {
    if (isAuthReady && flowStep === 'done') navigate(from, { replace: true });
  }, [isAuthReady, flowStep]);

  // Pre-fill the profile from a Google account.
  useEffect(() => {
    if (fbUser && !fbUser.isAnonymous) {
      const [first = '', ...rest] = (fbUser.displayName || '').split(' ');
      setProfile((p) => ({ ...p, firstName: p.firstName || first, lastName: p.lastName || rest.join(' '), email: p.email || fbUser.email || '' }));
    }
  }, [fbUser]);

  useEffect(() => {
    if ((flowStep === 'start' || flowStep === 'link-phone') && phase === 'enter-phone') {
      try {
        if (window.recaptchaVerifier) { window.recaptchaVerifier.clear(); }
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'normal' });
        window.recaptchaVerifier.render();
      } catch (e) { console.error('Recaptcha error:', e); }
    }
  }, [flowStep, phase]);

  const handleGoogle = async () => {
    setError(''); setLoading(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      // onAuthStateChanged moves us to the "verify your phone" step (or onward if a phone is already linked).
    } catch (err) {
      setError(authErrorMessage(err));
    } finally { setLoading(false); }
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const fullPhone = `${countryCode}${phone.replace(/^0+/, '')}`;
      const verifier = window.recaptchaVerifier!;
      // Signed in with Google but no phone yet: LINK the phone to this same account (no second account is created).
      const result = auth.currentUser && !auth.currentUser.isAnonymous
        ? await linkWithPhoneNumber(auth.currentUser, fullPhone, verifier)
        : await signInWithPhoneNumber(auth, fullPhone, verifier);
      setConfirmation(result);
      setPhase('enter-otp');
    } catch (err) {
      setError(authErrorMessage(err));
    } finally { setLoading(false); }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const result = await confirmation!.confirm(otp);
      const uid = result.user.uid;
      // The server only accepts tokens that carry the verified phone number, so refresh the token now.
      await result.user.getIdToken(true);
      const userDoc = await getDoc(doc(db, 'customers', uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        const verifiedPhone = result.user.phoneNumber || data.phone;
        if (data.phone !== verifiedPhone) await setDoc(doc(db, 'customers', uid), { phone: verifiedPhone }, { merge: true });
        login({ id: uid, name: `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim() || 'User', email: data.email || '', role: 'customer', isPrimeMember: false, phone: verifiedPhone });
      }
      setPhase('enter-phone');
      setOtp('');
      // If there is no profile yet, getLoginStep now returns "profile" and the profile form appears.
    } catch (err) {
      setError(authErrorMessage(err));
    } finally { setLoading(false); }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const current = auth.currentUser!;
      const verifiedPhone = current.phoneNumber;
      if (!verifiedPhone) throw new Error('phone-not-verified');
      const customerData = {
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        gender: profile.gender,
        age: profile.age,
        phone: verifiedPhone,
        role: 'customer',
        isPrimeMember: false,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'customers', current.uid), customerData);
      login({ id: current.uid, name: `${profile.firstName} ${profile.lastName}`, email: profile.email, role: 'customer', isPrimeMember: false, phone: verifiedPhone });
    } catch (err) {
      setError('We could not save your profile. Please try again.');
    } finally { setLoading(false); }
  };

  const handleUseDifferentAccount = async () => {
    await signOut(auth);
    setPhase('enter-phone'); setOtp(''); setConfirmation(null); setError('');
  };

  const COUNTRY_CODES = ALL_COUNTRIES.filter(c => (c as any).dialCode).map(c => ({ code: (c as any).dialCode, flag: (c as any).flag || '', name: c.name }));

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F0] px-4">
      <div className="bg-white p-10 shadow-sm border border-gray-100 w-full max-w-md">
        <h2 className="font-display uppercase tracking-[0.3em] text-xl mb-2 text-center">LUXARDO FASHION</h2>
        <p className="text-xs text-gray-400 tracking-widest uppercase text-center mb-8">
          {(flowStep === 'start' || flowStep === 'link-phone') && phase === 'enter-phone' && (flowStep === 'link-phone' ? 'Verify your mobile number' : 'Sign in')}
          {(flowStep === 'start' || flowStep === 'link-phone') && phase === 'enter-otp' && 'Enter OTP'}
          {flowStep === 'profile' && 'Complete your profile'}
        </p>

        {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}

        {flowStep === 'link-phone' && phase === 'enter-phone' && (
          <p className="text-sm text-gray-500 mb-4 text-center">
            You are signed in{fbUser?.email ? ` as ${fbUser.email}` : ''}. To place an order, please verify your mobile number with a one-time code.
          </p>
        )}

        {flowStep === 'start' && phase === 'enter-phone' && (
          <>
            <button type="button" onClick={handleGoogle} disabled={loading}
              className="w-full border border-gray-300 py-3 text-xs uppercase tracking-widest hover:bg-gray-50 transition-all disabled:opacity-50 mb-2">
              Continue with Google
            </button>
            <p className="text-[11px] text-gray-400 text-center mb-5">You will verify your mobile number with a one-time code before ordering.</p>
            <div className="flex items-center gap-3 mb-5"><span className="flex-1 h-px bg-gray-200" /><span className="text-[10px] uppercase tracking-widest text-gray-400">or use your mobile number</span><span className="flex-1 h-px bg-gray-200" /></div>
          </>
        )}

        {(flowStep === 'start' || flowStep === 'link-phone') && phase === 'enter-phone' && (
          <form onSubmit={handleSendOTP}>
            <div className="flex gap-2 mb-4">
              <select
                value={countryCode}
                onChange={e => setCountryCode(e.target.value)}
                className="border border-gray-200 px-2 py-3 text-sm focus:outline-none focus:border-black w-28"
              >
                <option value="+91">{'\u{1F1EE}\u{1F1F3}'} +91</option>
                <option value="+1">{'\u{1F1FA}\u{1F1F8}'} +1</option>
                <option value="+44">{'\u{1F1EC}\u{1F1E7}'} +44</option>
                <option value="+971">{'\u{1F1E6}\u{1F1EA}'} +971</option>
                <option value="+65">{'\u{1F1F8}\u{1F1EC}'} +65</option>
                <option value="+60">{'\u{1F1F2}\u{1F1FE}'} +60</option>
                <option value="+61">{'\u{1F1E6}\u{1F1FA}'} +61</option>
                <option value="+49">{'\u{1F1E9}\u{1F1EA}'} +49</option>
                <option value="+33">{'\u{1F1EB}\u{1F1F7}'} +33</option>
              </select>
              <input
                type="tel"
                placeholder="Mobile number"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                required
                className="flex-1 border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-black"
              />
            </div>
            <div id="recaptcha-container" ref={recaptchaRef} className="mb-4 flex justify-center"></div>
            <button type="submit" disabled={loading || !phone}
              className="w-full bg-black text-white py-4 text-xs uppercase tracking-widest hover:bg-gray-800 transition-all disabled:opacity-50">
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
            {flowStep === 'link-phone' && (
              <button type="button" onClick={handleUseDifferentAccount} className="w-full mt-3 text-xs text-gray-400 underline">
                Use a different account
              </button>
            )}
          </form>
        )}

        {(flowStep === 'start' || flowStep === 'link-phone') && phase === 'enter-otp' && (
          <form onSubmit={handleVerifyOTP}>
            <p className="text-sm text-gray-500 mb-4 text-center">OTP sent to {countryCode} {phone}</p>
            <input
              type="text" placeholder="Enter 6-digit OTP" value={otp}
              onChange={e => setOtp(e.target.value)} maxLength={6} required
              className="w-full border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-black mb-4 text-center tracking-widest"
            />
            <button type="submit" disabled={loading || otp.length < 6}
              className="w-full bg-black text-white py-4 text-xs uppercase tracking-widest hover:bg-gray-800 transition-all disabled:opacity-50">
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
            <button type="button" onClick={() => { setPhase('enter-phone'); setOtp(''); setError(''); }}
              className="w-full mt-3 text-xs text-gray-400 underline">
              Change number
            </button>
          </form>
        )}

        {flowStep === 'profile' && (
          <form onSubmit={handleProfileSubmit}>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <input placeholder="First name" value={profile.firstName} onChange={e => setProfile(p => ({...p, firstName: e.target.value}))} required
                className="border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-black"/>
              <input placeholder="Last name" value={profile.lastName} onChange={e => setProfile(p => ({...p, lastName: e.target.value}))} required
                className="border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-black"/>
            </div>
            <input type="email" placeholder="Email address" value={profile.email} onChange={e => setProfile(p => ({...p, email: e.target.value}))} required
              className="w-full border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-black mb-3"/>
            <div className="flex gap-3 mb-3">
              <input type="number" placeholder="Age" value={profile.age} onChange={e => setProfile(p => ({...p, age: e.target.value}))} required min="18" max="100"
                className="w-1/2 border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-black"/>
              <select value={profile.gender} onChange={e => setProfile(p => ({...p, gender: e.target.value}))} required
                className="w-1/2 border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-black">
                <option value="">Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="border border-gray-100 px-4 py-3 text-sm text-gray-400 mb-4 bg-gray-50">
              {'\u{1F4F1}'} {auth.currentUser?.phoneNumber} (verified)
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-black text-white py-4 text-xs uppercase tracking-widest hover:bg-gray-800 transition-all disabled:opacity-50">
              {loading ? 'Saving...' : 'Complete Setup'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
