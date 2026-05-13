import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const MASTER_ADMIN_EMAIL = 'luxardodigiwork@gmail.com';

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
  isAuthReady: boolean;
  logout: () => Promise<void>;
  login: (userData: User) => void;
  updateUserPreferences: (preferences: Partial<User>) => void;
  loginAdmin: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string, resetCode: string, newPassword: string) => Promise<void>;
  upgradeToPrime: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // 🔐 AUTO-PROVISION ADMIN: If master email logs in but no customer doc, create one with role:admin
          const isMasterAdmin = firebaseUser.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();
          const customerRef = doc(db, 'customers', firebaseUser.uid);
          let customerDoc = await getDoc(customerRef);

          if (!customerDoc.exists() && isMasterAdmin) {
            console.log('[AuthContext] Master admin login — auto-provisioning customer doc with role:admin');
            const adminData = {
              id: firebaseUser.uid,
              name: 'Admin',
              email: firebaseUser.email,
              role: 'admin',
              isPrimeMember: false,
              createdAt: new Date().toISOString(),
              permissions: {
                products: true, orders: true, content: true, media: true,
                customers: true, dispatch: true, settings: true,
              },
            };
            await setDoc(customerRef, adminData);
            customerDoc = await getDoc(customerRef);
          }

          if (customerDoc.exists()) {
            const data = customerDoc.data();
            const userData: User = {
              id: firebaseUser.uid,
              name: data.firstName ? `${data.firstName} ${data.lastName || ''}`.trim() : data.name || 'User',
              email: data.email || firebaseUser.email || '',
              role: data.role || 'customer',
              isPrimeMember: data.isPrimeMember || false,
              phone: data.phone || firebaseUser.phoneNumber || '',
              country: data.country, language: data.language, currency: data.currency,
              createdAt: data.createdAt,
              membershipActivation: data.membershipActivation,
              membershipExpiry: data.membershipExpiry,
              forcePasswordReset: data.forcePasswordReset,
              permissions: data.permissions,
              primePrivileges: data.primePrivileges,
              notes: data.notes,
            };
            setUser(userData);
            localStorage.setItem('LUXARDO FASHION_user', JSON.stringify(userData));
            localStorage.removeItem('LUXARDO FASHION_logged_out');
          } else {
            const fallback: User = {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || 'User',
              email: firebaseUser.email || '',
              role: 'customer',
              isPrimeMember: false,
              phone: firebaseUser.phoneNumber || '',
            };
            setUser(fallback);
            localStorage.setItem('LUXARDO FASHION_user', JSON.stringify(fallback));
          }
        } else {
          setUser(null);
          localStorage.removeItem('LUXARDO FASHION_user');
        }
      } catch (err) {
        console.error('Auth state change error:', err);
      } finally {
        setIsAuthReady(true);
      }
    });
    return () => unsubscribe();
  }, []);

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem('LUXARDO FASHION_user', JSON.stringify(userData));
    localStorage.removeItem('LUXARDO FASHION_logged_out');
  };

  const logout = async () => {
    try { if (auth.currentUser) await signOut(auth); } catch (err) {}
    setUser(null);
    localStorage.removeItem('LUXARDO FASHION_user');
    localStorage.setItem('LUXARDO FASHION_logged_out', 'true');
  };

  const updateUserPreferences = (preferences: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...preferences };
    setUser(updated);
    localStorage.setItem('LUXARDO FASHION_user', JSON.stringify(updated));
    if (auth.currentUser && user.role === 'customer') {
      const updateData: Record<string, any> = { lastUpdated: new Date().toISOString() };
      Object.keys(preferences).forEach(k => {
        if ((preferences as any)[k] !== undefined) updateData[k] = (preferences as any)[k];
      });
      setDoc(doc(db, 'customers', auth.currentUser.uid), updateData, { merge: true })
        .catch(e => console.error('Sync error:', e));
    }
  };

  const loginAdmin = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const resetPassword = async (email: string, code: string, newPassword: string) => {
    console.log('Reset password for', email);
  };

  const upgradeToPrime = () => {
    if (user) updateUserPreferences({ isPrimeMember: true });
  };

  return (
    <AuthContext.Provider value={{
      user, isLoggedIn: !!user, isAuthReady, logout, login,
      updateUserPreferences, loginAdmin, resetPassword, upgradeToPrime,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
