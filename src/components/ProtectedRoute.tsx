import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Guards customer-only pages (account, orders, checkout).
 * Waits for Firebase auth to resolve first, so a hard refresh on a protected
 * page does not bounce a signed-in customer to /login. Real data protection is
 * enforced by Firestore rules and Cloud Functions, not by this component.
 */
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthReady } = useAuth();
  const location = useLocation();

  if (!isAuthReady) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-divider border-t-brand-black rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
