import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ALL_COUNTRIES } from '../countries';

declare global { interface Window { recaptchaVerifier?: RecaptchaVerifier; } }

type Step = 'phone' | 'otp' | 'profile';

// Test accounts — hidden from UI, only work when exact number is entered
const TEST_ACCOUNTS: Record<string, { otp: string; role: string; name: string; email: string }> = {
  '+915799957999': { otp: '999755', role: 'customer', name: 'Test User', email: 'testuser@luxardo.com' },
  '+915700057000': { otp: '999755', role: 'admin', name: 'Test Admin', email: 'testadmin@luxardo.com' },
};

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthReady, login } = useAuth();
  const from = (location.state as any)?.from?.pathname || '/';

  const [step, setStep] = useState<Step>('phone');
  const [countryCode, setCountryCode] = useState('+91');
  const [countryFlag, setCountryFlag] = useState('\u{1F1EE}\u{1F1F3}');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState({ firstName: '', lastName: '', email: '', gender: '', age: '' });
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const [isTestAccount, setIsTestAccount] = useState(false);
  const [testAccountData, setTestAccountData] = useState<typeof TEST_ACCOUNTS[string] | null>(null);

  useEffect(() => {
    if (isAuthReady && user) navigate(from, { replace: true });
  }, [user, isAuthReady]);

  useEffect(() => {
    if (step === 'phone' && !isTestAccount) {
      try {
        if (window.recaptchaVerifier) { window.recaptchaVerifier.clear(); }
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'normal' });
        window.recaptchaVerifier.render();
      } catch (e) { console.error('Recaptcha error:', e); }
    }
  }, [step]);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const fullPhone = `${countryCode}${phone.replace(/^0+/, '')}`;

      // Check if this is a test account
      const testData = TEST_ACCOUNTS[fullPhone];
      if (testData) {
        setIsTestAccount(true);
        setTestAccountData(testData);
        setStep('otp');
        setLoading(false);
        return;
      }

      const verifier = window.recaptchaVerifier!;
      const result = await signInWithPhoneNumber(auth, fullPhone, verifier);
      setConfirmation(result);
      setStep('otp');
    } catch (err: any) {
      setError('OTP bhejne me error. Phone number check karo.');
    } finally { setLoading(false); }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      // Test account bypass
      if (isTestAccount && testAccountData) {
        if (otp === testAccountData.otp) {
          const testId = `test-${testAccountData.role}-${Date.now()}`;
          login({
            id: testId,
            name: testAccountData.name,
            email: testAccountData.email,
            role: testAccountData.role,
            isPrimeMember: false,
            phone: `${countryCode}${phone}`,
          });
          if (testAccountData.role === 'admin') {
            navigate('/admin/dashboard', { replace: true });
          } else {
            navigate(from, { replace: true });
          }
          setLoading(false);
          return;
        } else {
          setError('OTP galat hai. Dobara try karo.');
          setLoading(false);
          return;
        }
      }

      const result = await confirmation!.confirm(otp);
      const uid = result.user.uid;
      const userDoc = await getDoc(doc(db, 'customers', uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        login({ id: uid, name: data.firstName + ' ' + data.lastName, email: data.email || '', role: 'customer', isPrimeMember: data.isPrimeMember || false, phone: data.phone });
        navigate(from, { replace: true });
      } else {
        setStep('profile');
      }
    } catch (err: any) {
      setError('OTP galat hai. Dobara try karo.');
    } finally { setLoading(false); }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const uid = auth.currentUser!.uid;
      const fullPhone = `${countryCode}${phone}`;
      const customerData = {
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        gender: profile.gender,
        age: profile.age,
        phone: fullPhone,
        role: 'customer',
        isPrimeMember: false,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'customers', uid), customerData);
      login({ id: uid, name: `${profile.firstName} ${profile.lastName}`, email: profile.email, role: 'customer', isPrimeMember: false, phone: fullPhone });
      navigate(from, { replace: true });
    } catch (err: any) {
      setError('Profile save karne me error.');
    } finally { setLoading(false); }
  };

  const COUNTRY_CODES = ALL_COUNTRIES.filter(c => (c as any).dialCode).map(c => ({ code: (c as any).dialCode, flag: (c as any).flag || '', name: c.name }));

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F0] px-4">
      <div className="bg-white p-10 shadow-sm border border-gray-100 w-full max-w-md">
        <h2 className="font-display uppercase tracking-[0.3em] text-xl mb-2 text-center">Luxardo</h2>
        <p className="text-xs text-gray-400 tracking-widest uppercase text-center mb-8">
          {step === 'phone' && 'Enter your mobile number'}
          {step === 'otp' && 'Enter OTP'}
          {step === 'profile' && 'Complete your profile'}
        </p>

        {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}

        {step === 'phone' && (
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
          </form>
        )}

        {step === 'otp' && (
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
            <button type="button" onClick={() => { setStep('phone'); setIsTestAccount(false); setTestAccountData(null); }}
              className="w-full mt-3 text-xs text-gray-400 underline">
              Change number
            </button>
          </form>
        )}

        {step === 'profile' && (
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
              {'\u{1F4F1}'} {countryCode} {phone} (verified)
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
