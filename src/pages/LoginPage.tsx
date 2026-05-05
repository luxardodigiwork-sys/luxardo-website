import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, isAuthReady, login } = useAuth();

  useEffect(() => {
    if (isAuthReady && user) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [user, isAuthReady, navigate]);

  const handleBypassLogin = () => {
    login({
      id: "admin-1",
      name: "Abhijeet Sir",
      role: "admin",
      isPrimeMember: true,
      // ⚡ सभी जरूरी परमिशन यहाँ जोड़ दी गई हैं
      permissions: { 
        dashboard: true, 
        orders: true, 
        products: true, 
        settings: true,
        dispatch_actions: true,
        backend_management: true,
        analysis_reports: true,
        media: true,
        content: true
      }
    });
    navigate('/admin/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F0]">
      <div className="bg-white p-12 shadow-xl text-center border border-gray-100">
        <h2 className="font-display uppercase tracking-[0.3em] text-2xl mb-8">Luxardo Access</h2>
        <p className="text-gray-400 mb-8 text-xs tracking-widest uppercase">Bypass Mode Active</p>
        <button 
          onClick={handleBypassLogin} 
          className="bg-black text-white px-12 py-4 text-sm uppercase tracking-widest hover:bg-gray-800 transition-all"
        >
          Enter Admin Portal
        </button>
      </div>
    </div>
  );
}