import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { resolveStaffRole } from '../utils/staffAuth';
import type { StaffRole } from '../utils/staffRole';

interface User {
  id: string;
  name: string;
  email?: string;
  role: string;
  isPrimeMember: boolean;
  permissions?: Record<string, boolean>;
  country?: string;
  language?: string;
  currency?: string;
  phone?: string;
  createdAt?: string;
  membershipActivation?: string;
  membershipExpiry?: string;
  forcePasswordReset?: boolean;
  primePrivileges?: {
    bespoke?: boolean;
    fabricLibrary?: boolean;
    consultation?: boolean;
    prioritySupport?: boolean;
  };
  notes?: string;
}

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  /** True only when Firestore rules confirm the signed-in account is an admin (server-trusted). */
  isAdmin: boolean;
  /** Server-trusted staff role (admin | owner | dispatch) or null for customers/guests. */
  staffRole: StaffRole | null;
  isAuthReady: boolean;
  logout: () => Promise<void>;
  login: (userData: User) => void;
  updateUserPreferences: (preferences: Partial<User>) => void;
  upgradeToPrime: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [staffRole, setStaffRole] = useState<StaffRole | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    // Drop any privileged identity cached by earlier versions of the app.
    try {
      localStorage.removeItem('LUXARDO FASHION_user');
      localStorage.removeItem('LUXARDO FASHION_logged_out');
    } catch {}

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          setUser(null);
          setIsAdmin(false);
          setStaffRole(null);
          return;
        }

        // Anonymous guest sessions (used for checkout) are not logged-in accounts.
        if (firebaseUser.isAnonymous) {
          setUser(null);
          setIsAdmin(false);
          setStaffRole(null);
          return;
        }

        const role = await resolveStaffRole(firebaseUser);
        const admin = role === 'admin';
        setStaffRole(role);
        setIsAdmin(admin);

        let data: Record<string, any> = {};
        let hasProfile = false;
        try {
          const customerDoc = await getDoc(doc(db, 'customers', firebaseUser.uid));
          if (customerDoc.exists()) { data = customerDoc.data(); hasProfile = true; }
        } catch (err) {
          console.error('Failed to load customer profile:', err);
        }

        // A brand-new account without a profile stays "not logged in" until it
        // completes the signup profile step (staff accounts don't need a customer profile).
        if (!hasProfile && !role) {
          setUser(null);
          return;
        }

        setUser({
          id: firebaseUser.uid,
          name: data.firstName
            ? `${data.firstName} ${data.lastName || ''}`.trim()
            : data.name || 'User',
          email: data.email || firebaseUser.email || '',
          // Role is derived from the server-enforced probe, never from the editable profile doc.
          role: role ?? 'customer',
          isPrimeMember: data.isPrimeMember === true,
          phone: data.phone || firebaseUser.phoneNumber || '',
          country: data.country,
          language: data.language,
          currency: 'INR', // INR only; any stored display-currency preference is ignored
          createdAt: data.createdAt,
          membershipActivation: data.membershipActivation,
          membershipExpiry: data.membershipExpiry,
          primePrivileges: data.primePrivileges,
        });
      } catch (err) {
        console.error('Auth state change error:', err);
        setUser(null);
        setIsAdmin(false);
        setStaffRole(null);
      } finally {
        setIsAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, []);

  /** Refresh local profile state after signup. Privilege fields are always forced to customer defaults. */
  const login = (userData: User) => {
    setUser({ ...userData, role: 'customer', isPrimeMember: false, permissions: undefined, primePrivileges: undefined });
  };

  const logout = async () => {
    try {
      if (auth.currentUser) await signOut(auth);
    } catch (err) {
      console.error('Firebase sign out error:', err);
    } finally {
      setUser(null);
      setIsAdmin(false);
      setStaffRole(null);
      try {
        sessionStorage.removeItem('LUXARDO FASHION_cart');
        localStorage.removeItem('LUXARDO FASHION_temp_preferences');
        localStorage.removeItem('LUXARDO FASHION_temp_wishlist');
      } catch {}
    }
  };

  const updateUserPreferences = (preferences: Partial<User>) => {
    if (!user) return;
    // Only harmless display preferences are editable by the customer.
    const allowed: Partial<User> = {};
    if (preferences.country !== undefined) allowed.country = preferences.country;
    if (preferences.language !== undefined) allowed.language = preferences.language;
    if (preferences.currency !== undefined) allowed.currency = preferences.currency;

    setUser({ ...user, ...allowed });

    if (auth.currentUser && !auth.currentUser.isAnonymous && Object.keys(allowed).length > 0) {
      setDoc(
        doc(db, 'customers', auth.currentUser.uid),
        { ...allowed, lastUpdated: new Date().toISOString() },
        { merge: true },
      ).catch((err) => console.error('Failed to sync preferences to Firestore:', err));
    }
  };

  /** Prime status can only be granted by the server after verified payment; the client cannot self-upgrade. */
  const upgradeToPrime = () => {
    console.warn('Prime membership is granted by the server after payment verification.');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        isAdmin,
        staffRole,
        isAuthReady,
        logout,
        login,
        updateUserPreferences,
        upgradeToPrime,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
