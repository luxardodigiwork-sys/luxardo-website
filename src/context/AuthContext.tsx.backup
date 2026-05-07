import React, { createContext, useContext, useState, useEffect } from 'react';

// ⚡ Permissions को बढ़ा दिया गया है ताकि कोई भी पेज ब्लॉक न हो
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
  };
}

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  isAuthReady: boolean;
  logout: () => void;
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
    try {
      const savedUser = localStorage.getItem("luxardo_user");
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        if (parsedUser?.id) setUser(parsedUser);
      }
      // नोट: यहां ऑटो-लॉगिन हटा दिया है ताकि LoginPage का बटन सही से काम करे
    } catch (err) {
      console.error("Auth error:", err);
    } finally {
      setIsAuthReady(true);
    }
  }, []);

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem("luxardo_user", JSON.stringify(userData));
    localStorage.removeItem("luxardo_logged_out");
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("luxardo_user");
    localStorage.setItem("luxardo_logged_out", "true");
  };

  const updateUserPreferences = (preferences: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...preferences };
      setUser(updatedUser);
      localStorage.setItem("luxardo_user", JSON.stringify(updatedUser));
    }
  };

  const loginAdmin = async (username: string, password: string) => {
    // Implement admin login logic
    console.log('Login admin', username, password);
    // For now, create a dummy admin user
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
    // Implement reset password logic
    console.log('Reset password for', email, resetCode, newPassword);
  };

  const upgradeToPrime = () => {
    if (user) {
      updateUserPreferences({ isPrimeMember: true });
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoggedIn: !!user, isAuthReady, logout, login, updateUserPreferences, loginAdmin, resetPassword, upgradeToPrime }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}