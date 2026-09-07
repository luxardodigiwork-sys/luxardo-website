import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader2 } from 'lucide-react';

/**
 * Production route guard.
 * - Unauthenticated → /admin/login
 * - No staffRole on the user object → /backend (e-commerce portal)
 *
 * Does NOT check specific roles — per-page role checks are done inside each page
 * using can() from rolePermissions.
 */
export default function ProtectedProductionRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthReady } = useAuth();

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-black mx-auto mb-4" />
          <p className="text-xs text-gray-500 uppercase tracking-widest">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/admin/login" replace />;
  if (!user.staffRole) return <Navigate to="/backend" replace />;

  return <>{children}</>;
}
