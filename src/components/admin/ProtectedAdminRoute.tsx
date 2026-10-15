import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { auth } from '../../firebase';
import { canAccessArea, homeForRole, StaffArea } from '../../utils/staffRole';

/**
 * Guards every back-office area. `area` is the area this route belongs to:
 *   admin    -> admin role only
 *   owner    -> owner role (admin may also open it)
 *   dispatch -> dispatch role (admin may also open it)
 * The role is server-trusted (custom claim / adminCheck probe); the real data protection is firestore.rules.
 * Use as a layout route (renders <Outlet />) or wrap children.
 */
export default function ProtectedAdminRoute({ children, area = 'admin' }: { children?: React.ReactNode; area?: StaffArea }) {
  const { staffRole, isAuthReady } = useAuth();
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
    return <Navigate to="/backend/login" replace state={{ from: location }} />;
  }
  if (!staffRole) {
    return <Navigate to="/backend/login" replace state={{ notStaff: true }} />;
  }
  if (!canAccessArea(staffRole, area)) {
    // Signed-in staff member opened a page of another role: send them to their own home.
    return <Navigate to={homeForRole(staffRole)} replace />;
  }

  return <>{children ?? <Outlet />}</>;
}
