/**
 * Which screen the login page shows, derived ONLY from real auth state (never from UI flags), so a customer cannot
 * skip phone verification by reloading or navigating around it.
 *
 *  start       - not signed in (or an anonymous session): choose phone OTP or Google
 *  link-phone  - signed in (e.g. with Google) but no verified phone number yet: must verify one before ordering
 *  profile     - phone verified, but no customer profile saved yet
 *  done        - signed in, phone verified, profile exists
 *
 * A customer who signs in with Google gets the SAME Firebase user (same uid, same profile, same order history) after
 * they link a phone number, so no duplicate account is created.
 */
export type LoginStep = 'start' | 'link-phone' | 'profile' | 'done';

export interface LoginFirebaseUser { isAnonymous: boolean; phoneNumber: string | null }

export function getLoginStep(input: { firebaseUser: LoginFirebaseUser | null; hasProfile: boolean }): LoginStep {
  const u = input.firebaseUser;
  if (!u || u.isAnonymous) return 'start';
  if (!u.phoneNumber) return 'link-phone';
  if (!input.hasProfile) return 'profile';
  return 'done';
}

/** Customer-safe message for an auth error code. */
export function authErrorMessage(err: unknown): string {
  const code: string = (err as any)?.code ?? '';
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was cancelled. Please try again.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google sign-in window. Please allow pop-ups for this site and try again.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using a different sign-in method. Sign in with your phone number first, then link Google from My Account.';
    case 'auth/credential-already-in-use':
    case 'auth/phone-number-already-exists':
      return 'This phone number is already registered to another account. Sign out, sign in with that phone number (OTP), and link Google from My Account instead.';
    case 'auth/invalid-phone-number':
      return 'Please enter a valid phone number.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes and try again.';
    case 'auth/invalid-verification-code':
      return 'That code is not correct. Please check it and try again.';
    case 'auth/code-expired':
      return 'That code has expired. Please request a new one.';
    case 'auth/network-request-failed':
      return 'Network problem. Please check your connection and try again.';
    case 'auth/unauthorized-domain':
      return 'Sign-in is not enabled for this website address yet. Please contact us.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled yet. Please contact us.';
    default:
      return 'Sign-in failed. Please try again.';
  }
}
