import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowRight, ChevronLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-brand-bg pt-32 pb-20">
      <div className="max-w-md mx-auto px-6">
        <Link to="/login" className="inline-flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-brand-secondary hover:text-brand-black mb-12">
          <ChevronLeft size={14} /> Back to Login
        </Link>

        {!submitted ? (
          <div className="space-y-12">
            <div className="text-center space-y-4">
              <h1 className="text-4xl font-display">Reset Password</h1>
              <p className="font-sans text-brand-secondary">Enter your email to receive a reset link</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary flex items-center gap-2">
                  <Mail size={12} /> Email Address
                </label>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-brand-white border border-brand-divider px-4 py-4 font-sans focus:outline-none focus:border-brand-black transition-colors"
                  placeholder="alexander@luxury.com"
                />
              </div>

              <button type="submit" className="btn-primary w-full py-5 flex items-center justify-center gap-4">
                SEND RESET LINK <ArrowRight size={18} />
              </button>
            </form>
          </div>
        ) : (
          <div className="text-center space-y-8">
            <div className="w-20 h-20 bg-brand-black text-brand-white rounded-full flex items-center justify-center mx-auto">
              <Mail size={32} />
            </div>
            <div className="space-y-4">
              <h2 className="text-3xl font-display">Check Your Email</h2>
              <p className="font-sans text-brand-secondary leading-relaxed">
                We've sent a password reset link to <span className="text-brand-black font-bold">{email}</span>. Please check your inbox and spam folder.
              </p>
            </div>
            <button 
              onClick={() => setSubmitted(false)}
              className="text-[11px] uppercase tracking-[0.25em] font-bold text-brand-black hover:opacity-60 transition-opacity"
            >
              Resend Link
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
