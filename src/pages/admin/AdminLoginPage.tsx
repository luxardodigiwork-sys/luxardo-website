import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, user, isAuthReady } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthReady && user && user.role === 'admin') {
      navigate('/admin/dashboard');
    }
  }, [user, isAuthReady, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      await login(email, password);
      // The useEffect will handle redirection if the user is an admin
    } catch (err: any) {
      setError(err.message || 'Invalid credentials.');
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
          <p className="text-brand-secondary text-sm">Enter your credentials to access the panel</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 mb-6 text-sm border border-red-100">
            {error}
          </div>
        )}

        {user && user.role !== 'admin' && (
          <div className="bg-amber-50 text-amber-700 p-4 mb-6 text-sm border border-amber-100">
            You are logged in but do not have administrator privileges.
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-xs uppercase tracking-wider text-brand-secondary">
              Admin Email
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-secondary" size={16} />
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-brand-divider p-4 pl-12 focus:outline-none focus:border-brand-black transition-colors"
                placeholder="admin or admin@luxardo.com"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs uppercase tracking-wider text-brand-secondary">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-secondary" size={16} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-brand-divider p-4 pl-12 focus:outline-none focus:border-brand-black transition-colors"
                placeholder="••••••••"
                required
              />
            </div>
          </div>
          
          <button type="submit" disabled={isLoading} className="w-full btn-primary py-4 flex items-center justify-center gap-3">
            {isLoading ? 'AUTHENTICATING...' : 'ACCESS DASHBOARD'} <ArrowRight size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
