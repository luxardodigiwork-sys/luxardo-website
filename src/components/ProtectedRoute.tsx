import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthReady } = useAuth();
  const location = useLocation();

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-divider border-t-brand-black rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    // Agar user logged in nahi hai, usko login par bhejo
    // aur location.state.from mein uski current jagah (jaise /wholesale) save kar do
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Agar staff/admin galti se yahan aa jaye, unhe unke dashboard par bhejo
  const userRole = user.role?.toLowerCase() || '';
  if (['admin', 'super_admin', 'dispatch', 'accounts', 'owner'].includes(userRole)) {
    return <Navigate to="/backend" replace />;
  }

  return <>{children}</>;
}