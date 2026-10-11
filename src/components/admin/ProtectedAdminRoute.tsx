import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { auth } from '../../firebase';

/**
 * Guards every back-office area (admin, dispatch, owner, analysis).
 * Authorization is `isAdmin` from AuthContext, which is derived from a Firestore
 * read that security rules only permit for admins (UID list / custom claim).
 * Use as a layout route (renders <Outlet />) or wrap children.
 */
export default function ProtectedAdminRoute({ children }: { children?: React.ReactNode }) {
  const { isAdmin, isAuthReady } = useAuth();
  const location = useLocation();

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <div className="w-12 h-12 border-4 border-brand-divider border-t-brand-black rounded-full animate-spin"></div>
      </div>
    );
  }

  const signedIn = !!auth.currentUser && !auth.currentUser.isAnonymous;
  if (!signedIn) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children ?? <Outlet />}</>;
}
