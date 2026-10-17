import { Navigate } from 'react-router-dom';

/**
 * Customers sign in with a phone number and a one-time code; there are no passwords, so there is nothing to
 * reset and no reset email is ever sent. This page is not routed anywhere; if it is ever reached it sends the
 * visitor to the real login instead of showing a misleading "reset link sent" message.
 */
export default function ForgotPasswordPage() {
  return <Navigate to="/login" replace />;
}
