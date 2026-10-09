import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

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
  loginAdmin: (username: string, password: string) => Promise<void>;
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
          const customerDoc = await getDoc(doc(db, 'customers', firebaseUser.uid));

          if (customerDoc.exists()) {
            const data = customerDoc.data();
            const userData: User = {
              id: firebaseUser.uid,
              name: data.firstName
                ? `${data.firstName} ${data.lastName || ''}`.trim()
                : data.name || 'User',
              email: data.email || firebaseUser.email || '',
              role: data.role || 'customer',
              isPrimeMember: data.isPrimeMember || false,
              phone: data.phone || firebaseUser.phoneNumber || '',
              country: data.country,
              language: data.language,
              currency: data.currency,
              createdAt: data.createdAt,
              membershipActivation: data.membershipActivation,
              membershipExpiry: data.membershipExpiry,
              forcePasswordReset: data.forcePasswordReset,
              permissions: data.permissions,
              primePrivileges: data.primePrivileges,
              notes: data.notes,
            };

            setUser(userData);
            localStorage.setItem('luxardo_user', JSON.stringify(userData));
            localStorage.removeItem('luxardo_logged_out');
          } else {
            const cached = localStorage.getItem('luxardo_user');
            if (cached) {
              try {
                const parsedUser = JSON.parse(cached);
                if (parsedUser?.id === firebaseUser.uid) {
                  setUser(parsedUser);
                } else {
                  localStorage.removeItem('luxardo_user');
                  setUser(null);
                }
              } catch {
                localStorage.removeItem('luxardo_user');
                setUser(null);
              }
            } else {
              setUser(null);
            }
          }
        } else {
          const cached = localStorage.getItem('luxardo_user');
          const wasLoggedOut = localStorage.getItem('luxardo_logged_out');

          if (cached && !wasLoggedOut) {
            try {
              const parsedUser = JSON.parse(cached);
              const adminRoles = ['admin', 'super_admin', 'dispatch', 'owner', 'analysis'];
              if (parsedUser?.id && adminRoles.includes(parsedUser.role)) {
                setUser(parsedUser);
              } else {
                localStorage.removeItem('luxardo_user');
                setUser(null);
              }
            } catch {
              localStorage.removeItem('luxardo_user');
              setUser(null);
            }
          } else {
            setUser(null);
          }
        }
      } catch (err) {
        console.error('Auth state change error:', err);
        try {
          const cached = localStorage.getItem('luxardo_user');
          if (cached) {
            const parsedUser = JSON.parse(cached);
            if (parsedUser?.id) setUser(parsedUser);
          }
        } catch {
          setUser(null);
        }
      } finally {
        setIsAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem('luxardo_user', JSON.stringify(userData));
    localStorage.removeItem('luxardo_logged_out');
  };

  const logout = async () => {
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }
    } catch (err) {
      console.error('Firebase sign out error:', err);
    } finally {
      setUser(null);
      localStorage.removeItem('luxardo_user');
      localStorage.setItem('luxardo_logged_out', 'true');
      try {
        sessionStorage.removeItem('luxardo_cart');
        localStorage.removeItem('luxardo_temp_preferences');
        localStorage.removeItem('luxardo_temp_wishlist');
      } catch {}
    }
  };

  const updateUserPreferences = (preferences: Partial<User>) => {
    if (!user) return;

    const updatedUser = { ...user, ...preferences };
    setUser(updatedUser);
    localStorage.setItem('luxardo_user', JSON.stringify(updatedUser));

    if (auth.currentUser && user.role === 'customer') {
      const updateData: Record<string, any> = {};
      if (preferences.country !== undefined) updateData.country = preferences.country;
      if (preferences.language !== undefined) updateData.language = preferences.language;
      if (preferences.currency !== undefined) updateData.currency = preferences.currency;
      if (preferences.isPrimeMember !== undefined) updateData.isPrimeMember = preferences.isPrimeMember;
      if (preferences.membershipActivation !== undefined) updateData.membershipActivation = preferences.membershipActivation;
      if (preferences.membershipExpiry !== undefined) updateData.membershipExpiry = preferences.membershipExpiry;
      if (preferences.primePrivileges !== undefined) updateData.primePrivileges = preferences.primePrivileges;

      if (Object.keys(updateData).length > 0) {
        updateData.lastUpdated = new Date().toISOString();
        setDoc(doc(db, 'customers', auth.currentUser.uid), updateData, { merge: true })
          .catch((err) => console.error('Failed to sync preferences to Firestore:', err));
      }
    }
  };

  const loginAdmin = async (username: string, password: string) => {
    console.log('Admin login:', username);
    const adminUser: User = {
      id: 'admin',
      name: 'Admin',
      email: username,
      role: 'admin',
      isPrimeMember: false,
    };
    login(adminUser);
  };

  const resetPassword = async (email: string, resetCode: string, newPassword: string) => {
    console.log('Reset password for', email, resetCode, newPassword);
  };

  const upgradeToPrime = () => {
    if (user) {
      updateUserPreferences({ isPrimeMember: true });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        isAuthReady,
        logout,
        login,
        updateUserPreferences,
        loginAdmin,
        resetPassword,
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
