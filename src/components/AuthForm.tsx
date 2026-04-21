import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export function AuthForm() {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // 1. Purana atka hua Captcha clear karo (Yahi error de raha tha)
      if ((window as any).recaptchaVerifier) {
        try {
          (window as any).recaptchaVerifier.clear();
        } catch (e) {}
        (window as any).recaptchaVerifier = null;
      }
      const container = document.getElementById('recaptcha-container');
      if (container) container.innerHTML = '';

      // 2. Naya fresh Captcha lagao
      (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { 
        size: 'invisible' 
      });
      
      const formattedPhone = phone.startsWith('+') ? phone : `+91${phone.replace(/\D/g, '')}`;
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, (window as any).recaptchaVerifier);
      (window as any).confirmationResult = confirmation;
      
      setStep('otp');
    } catch (err: any) {
      console.error(err);
      setError("Error! Try again. Format: 9999999999");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await (window as any).confirmationResult.confirm(otp);
      const user = result.user;

      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const role = userSnap.data().role;
        window.location.href = (role === 'admin' || role === 'super_admin') ? '/admin/dashboard' : from;
      } else {
        await setDoc(userRef, {
          phone: user.phoneNumber,
          role: 'customer',
          createdAt: new Date()
        });
        window.location.href = from;
      }
    } catch (err: any) {
      console.error(err);
      setError('Galat OTP. Kripya dubara try karein.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[400px] mx-auto px-6">
      {/* Yeh div zaroori hai captcha ke liye */}
      <div id="recaptcha-container"></div>
      
      <div className="text-center space-y-3 mb-10">
        <div className="flex justify-center mb-4">
           <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center">
             <CheckCircle2 size={20} className="text-black" />
           </div>
        </div>
        <h1 className="text-3xl font-display tracking-tight">Client Login</h1>
        <p className="font-sans text-xs uppercase tracking-widest text-brand-secondary">Secured with 2-Factor Authentication</p>
      </div>

      {error && (
        <div className="mb-8 p-4 bg-red-50 border border-red-100 flex items-start gap-3 text-red-800 text-xs font-sans rounded-sm">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {step === 'phone' ? (
        <form onSubmit={handlePhoneSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary">Mobile Number</label>
            <div className="flex items-center border border-gray-200 rounded-md bg-gray-50 overflow-hidden">
               <div className="px-3 text-gray-500 text-sm border-r border-gray-200">+91</div>
               <input 
                 type="tel" required value={phone.replace('+91', '')} onChange={(e) => setPhone(e.target.value)}
                 className="w-full bg-transparent px-3 py-3 font-sans text-sm focus:outline-none"
                 placeholder="99999 99999"
               />
            </div>
          </div>
          <button type="submit" disabled={isLoading} className="w-full py-4 flex items-center justify-center gap-3 mt-6 rounded-md bg-black text-white text-xs tracking-widest uppercase hover:bg-gray-800 transition-colors">
            {isLoading ? 'PROCESSING...' : 'CONTINUE TO VERIFY'} <ArrowRight size={16} />
          </button>
        </form>
      ) : (
        <form onSubmit={handleOtpSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <label className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary">Security Code</label>
              <button type="button" onClick={() => setStep('phone')} className="text-[10px] text-gray-500 hover:text-black">← CHANGE NUMBER</button>
            </div>
            <input 
              type="text" required maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              className="w-full border border-gray-200 rounded-md px-4 py-3 font-sans text-2xl tracking-[0.5em] focus:outline-none focus:border-black transition-all"
              placeholder="••••••"
            />
          </div>
          <button type="submit" disabled={isLoading || otp.length < 6} className="w-full py-4 flex items-center justify-center gap-3 mt-6 rounded-md bg-black text-white text-xs tracking-widest uppercase hover:bg-gray-800 transition-colors">
            {isLoading ? 'VERIFYING...' : 'VERIFY & LOGIN'} <CheckCircle2 size={16} />
          </button>
        </form>
      )}
    </div>
  );
}
