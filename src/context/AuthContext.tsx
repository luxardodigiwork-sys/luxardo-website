import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  signInWithPopup, 
  GoogleAuthProvider,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { storage } from '../utils/localStorage';
import { User } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  isAuthReady: boolean;
  login: (email: string, password?: string) => Promise<void>;
  register: (userData: Partial<User> & { password?: string }) => Promise<void>;
  socialLogin: (provider: 'google' | 'apple') => Promise<void>;
  logout: () => Promise<void>;
  upgradeToPrime: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        storage.logoutAdmin();
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        try {
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            setUser(userDoc.data() as User);
          } else {
            console.warn('User document does not exist for UID:', firebaseUser.uid);
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      } else {
        // Check for dummy admin session
        if (storage.isAdminLoggedIn()) {
          setUser({
            id: 'dummy-admin-id',
            name: 'Luxardo Admin',
            email: 'admin@luxardo.com',
            role: 'admin',
            isPrimeMember: true,
            createdAt: new Date().toISOString()
          });
        } else {
          setUser(null);
        }
      }
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  // Real-time user profile updates
  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubscribe = onSnapshot(doc(db, 'users', auth.currentUser.uid), (doc) => {
      if (doc.exists()) {
        setUser(doc.data() as User);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${auth.currentUser?.uid}`);
    });

    return () => unsubscribe();
  }, [isAuthReady]);

  const register = useCallback(async (userData: Partial<User> & { password?: string }) => {
    try {
      const { user: firebaseUser } = await createUserWithEmailAndPassword(
        auth, 
        userData.email!, 
        userData.password!
      );

      const newUser: User = {
        id: firebaseUser.uid,
        name: userData.name || 'Luxardo Client',
        email: userData.email!,
        phone: userData.phone || '',
        country: userData.country || 'United States',
        createdAt: new Date().toISOString(),
        isPrimeMember: false,
        role: 'user',
      };

      await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
      setUser(newUser);
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }, []);

  const login = useCallback(async (email: string, password?: string) => {
    // Special case for dummy admin login as requested by user
    if (email === 'admin' && password === 'admin123') {
      const dummyAdmin: User = {
        id: 'dummy-admin-id',
        name: 'Luxardo Admin',
        email: 'admin@luxardo.com',
        role: 'admin',
        isPrimeMember: true,
        createdAt: new Date().toISOString()
      };
      setUser(dummyAdmin);
      storage.loginAdmin();
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password!);
      storage.logoutAdmin();
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }, []);

  const socialLogin = useCallback(async (provider: 'google' | 'apple') => {
    if (provider === 'apple') {
      throw new Error('Apple login not implemented in this environment.');
    }

    try {
      const googleProvider = new GoogleAuthProvider();
      const { user: firebaseUser } = await signInWithPopup(auth, googleProvider);

      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        const newUser: User = {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || 'Google Client',
          email: firebaseUser.email!,
          phone: firebaseUser.phoneNumber || '',
          country: 'United States',
          createdAt: new Date().toISOString(),
          isPrimeMember: false,
          role: 'user',
        };
        await setDoc(userDocRef, newUser);
        setUser(newUser);
      }
    } catch (error) {
      console.error('Social login error:', error);
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
      storage.logoutAdmin();
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, []);

  const upgradeToPrime = useCallback(async () => {
    if (!user || !auth.currentUser) return;

    const userDocRef = doc(db, 'users', auth.currentUser.uid);
    const updates = {
      isPrimeMember: true,
      membershipActivation: new Date().toISOString(),
      membershipExpiry: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString(),
    };

    try {
      await updateDoc(userDocRef, updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ 
      user, 
      isLoggedIn: !!user, 
      isAuthReady,
      login, 
      register, 
      socialLogin, 
      logout, 
      upgradeToPrime 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
