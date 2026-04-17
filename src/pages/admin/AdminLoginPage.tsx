import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, KeyRound, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../firebase';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState<'login' | 'request_reset' | 'verify_reset'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const { loginAdmin, user, isAuthReady } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthReady && user) {
      if (['super_admin', 'admin'].includes(user.role)) {
        navigate('/admin/dashboard');
      } else if (user.role === 'customer') {
        navigate('/account');
      }
    }
  }, [user, isAuthReady, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);
    
    try {
      await loginAdmin(email, password);
      // Explicit redirect
      navigate('/admin/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials or unauthorized access.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your admin email to recover your password.');
      return;
    }
    setError('');
    setMessage('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/recover-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send recovery email.');
      
      setMessage(data.message + (data.mockCode ? ` (Mock Code: ${data.mockCode})` : ''));
      setStep('verify_reset');
    } catch (err: any) {
      setError(err.message || 'Failed to send recovery email.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password.');
      
      setMessage('Password reset successfully. You can now log in.');
      setStep('login');
      setPassword('');
      setCode('');
      setNewPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white p-10 border border-brand-divider shadow-sm">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-bg rounded-full mb-6">
            <Lock size={24} className="text-brand-black" />
          </div>
          <h1 className="text-3xl font-display mb-2 uppercase tracking-widest">Luxardo Admin</h1>
          <p className="text-brand-secondary text-sm">
            {step === 'login' && 'Enter your credentials to access the panel'}
            {step === 'request_reset' && 'Recover your master access'}
            {step === 'verify_reset' && 'Verify your recovery code'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 mb-6 text-sm border border-red-100">
            {error}
          </div>
        )}

        {message && (
          <div className="bg-green-50 text-green-700 p-4 mb-6 text-sm border border-green-100">
            {message}
          </div>
        )}

        {user && !['super_admin', 'admin'].includes(user.role) && (
          <div className="bg-amber-50 text-amber-700 p-4 mb-6 text-sm border border-amber-100">
            You are logged in but do not have administrator privileges.
          </div>
        )}

        {step === 'login' && (
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-xs uppercase tracking-wider text-brand-secondary">
                Admin Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-secondary" size={16} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-brand-divider p-4 pl-12 focus:outline-none focus:border-brand-black transition-colors"
                  placeholder="admin@luxardo.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="block text-xs uppercase tracking-wider text-brand-secondary">
                  Password
                </label>
                <button 
                  type="button" 
                  onClick={() => setStep('request_reset')}
                  className="text-xs text-brand-secondary hover:text-brand-black transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-secondary" size={16} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-brand-divider p-4 pl-12 pr-12 focus:outline-none focus:border-brand-black transition-colors"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-secondary hover:text-brand-black transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            
            <button type="submit" disabled={isLoading} className="w-full btn-primary py-4 flex items-center justify-center gap-3">
              {isLoading ? 'AUTHENTICATING...' : 'ACCESS DASHBOARD'} <ArrowRight size={18} />
            </button>
          </form>
        )}

        {step === 'request_reset' && (
          <form onSubmit={handleRequestReset} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-xs uppercase tracking-wider text-brand-secondary">
                Admin Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-secondary" size={16} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-brand-divider p-4 pl-12 focus:outline-none focus:border-brand-black transition-colors"
                  placeholder="admin@luxardo.com"
                  required
                />
              </div>
            </div>
            
            <button type="submit" disabled={isLoading} className="w-full btn-primary py-4 flex items-center justify-center gap-3">
              {isLoading ? 'SENDING...' : 'SEND RECOVERY EMAIL'} <ArrowRight size={18} />
            </button>
            <button 
              type="button" 
              onClick={() => setStep('login')}
              className="w-full py-4 text-sm text-brand-secondary hover:text-brand-black transition-colors"
            >
              Back to Login
            </button>
          </form>
        )}

        {step === 'verify_reset' && (
          <form onSubmit={handleVerifyReset} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-xs uppercase tracking-wider text-brand-secondary">
                Verification Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full border border-brand-divider p-4 focus:outline-none focus:border-brand-black transition-colors text-center tracking-widest"
                placeholder="123456"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs uppercase tracking-wider text-brand-secondary">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border border-brand-divider p-4 pr-12 focus:outline-none focus:border-brand-black transition-colors"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-secondary hover:text-brand-black transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            
            <button type="submit" disabled={isLoading} className="w-full btn-primary py-4 flex items-center justify-center gap-3">
              {isLoading ? 'VERIFYING...' : 'RESET PASSWORD'} <ArrowRight size={18} />
            </button>
            <button 
              type="button" 
              onClick={() => setStep('login')}
              className="w-full py-4 text-sm text-brand-secondary hover:text-brand-black transition-colors"
            >
              Back to Login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
