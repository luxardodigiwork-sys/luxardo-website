import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  Firestore
} from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import { db, auth } from '../firebase';
import { User } from '../types';

/**
 * Firebase Storage - Complete replacement for localStorage
 * Stores all user data in Firestore instead of browser localStorage
 */

// ==================== USER DATA ====================
export const firebaseStorage = {
  // ===== USER PROFILE =====
  async saveUser(user: User): Promise<void> {
    try {
      if (!auth.currentUser) {
        console.error('No authenticated user');
        return;
      }

      await setDoc(doc(db, 'users', auth.currentUser.uid), {
        id: auth.currentUser.uid,
        email: auth.currentUser.email,
        ...user,
        lastUpdated: new Date().toISOString(),
      }, { merge: true });
    } catch (err) {
      console.error('Failed to save user:', err);
      throw err;
    }
  },

  async getUser(): Promise<User | null> {
    try {
      if (!auth.currentUser) {
        return null;
      }

      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        return userDoc.data() as User;
      }
      return null;
    } catch (err) {
      console.error('Failed to get user:', err);
      return null;
    }
  },

  async deleteUser(): Promise<void> {
    try {
      if (!auth.currentUser) return;
      await deleteDoc(doc(db, 'users', auth.currentUser.uid));
    } catch (err) {
      console.error('Failed to delete user:', err);
      throw err;
    }
  },

  // ===== USER PREFERENCES (Language, Country, Currency) =====
  async saveUserPreferences(preferences: {
    language?: string;
    country?: string;
    currency?: string;
  }): Promise<void> {
    try {
      // For anonymous users, use localStorage temporarily
      if (!auth.currentUser) {
        localStorage.setItem('luxardo_temp_preferences', JSON.stringify(preferences));
        return;
      }

      const prefDoc = doc(db, 'userPreferences', auth.currentUser.uid);
      await setDoc(prefDoc, {
        language: preferences.language,
        country: preferences.country,
        currency: preferences.currency,
        lastUpdated: new Date().toISOString(),
      }, { merge: true });
    } catch (err) {
      console.error('Failed to save preferences:', err);
      throw err;
    }
  },

  async getUserPreferences(): Promise<{
    language?: string;
    country?: string;
    currency?: string;
  } | null> {
    try {
      // For anonymous users, try localStorage first
      if (!auth.currentUser) {
        const stored = localStorage.getItem('luxardo_temp_preferences');
        return stored ? JSON.parse(stored) : null;
      }

      const prefDoc = await getDoc(doc(db, 'userPreferences', auth.currentUser.uid));
      return prefDoc.exists() ? (prefDoc.data() as any) : null;
    } catch (err) {
      console.error('Failed to get preferences:', err);
      return null;
    }
  },

  // ===== CART DATA =====
  async saveCart(cartItems: any[]): Promise<void> {
    try {
      // For anonymous users, use sessionStorage
      if (!auth.currentUser) {
        const minimal = cartItems.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
          size: item.size,
        }));
        sessionStorage.setItem('luxardo_cart', JSON.stringify(minimal));
        return;
      }

      const cartDoc = doc(db, 'carts', auth.currentUser.uid);
      const minimal = cartItems.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        size: item.size,
      }));

      await setDoc(cartDoc, {
        items: minimal,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (err) {
      console.error('Failed to save cart:', err);
      // Fallback to sessionStorage
      const minimal = cartItems.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        size: item.size,
      }));
      sessionStorage.setItem('luxardo_cart', JSON.stringify(minimal));
    }
  },

  async getCart(): Promise<any[] | null> {
    try {
      // For anonymous users, use sessionStorage
      if (!auth.currentUser) {
        const stored = sessionStorage.getItem('luxardo_cart');
        return stored ? JSON.parse(stored) : null;
      }

      const cartDoc = await getDoc(doc(db, 'carts', auth.currentUser.uid));
      return cartDoc.exists() ? (cartDoc.data() as any)?.items : null;
    } catch (err) {
      console.error('Failed to get cart:', err);
      // Fallback to sessionStorage
      const stored = sessionStorage.getItem('luxardo_cart');
      return stored ? JSON.parse(stored) : null;
    }
  },

  async clearCart(): Promise<void> {
    try {
      if (!auth.currentUser) {
        sessionStorage.removeItem('luxardo_cart');
        return;
      }

      const cartDoc = doc(db, 'carts', auth.currentUser.uid);
      await setDoc(cartDoc, { items: [], updatedAt: new Date().toISOString() });
    } catch (err) {
      console.error('Failed to clear cart:', err);
      sessionStorage.removeItem('luxardo_cart');
    }
  },

  // ===== WISHLIST DATA =====
  async saveWishlist(items: string[]): Promise<void> {
    try {
      if (!auth.currentUser) {
        localStorage.setItem('luxardo_temp_wishlist', JSON.stringify(items));
        return;
      }

      const wishlistDoc = doc(db, 'wishlists', auth.currentUser.uid);
      await setDoc(wishlistDoc, {
        items,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (err) {
      console.error('Failed to save wishlist:', err);
      localStorage.setItem('luxardo_temp_wishlist', JSON.stringify(items));
    }
  },

  async getWishlist(): Promise<string[] | null> {
    try {
      if (!auth.currentUser) {
        const stored = localStorage.getItem('luxardo_temp_wishlist');
        return stored ? JSON.parse(stored) : null;
      }

      const wishlistDoc = await getDoc(doc(db, 'wishlists', auth.currentUser.uid));
      return wishlistDoc.exists() ? (wishlistDoc.data() as any)?.items : null;
    } catch (err) {
      console.error('Failed to get wishlist:', err);
      const stored = localStorage.getItem('luxardo_temp_wishlist');
      return stored ? JSON.parse(stored) : null;
    }
  },

  // ===== FIRST VISIT / ONBOARDING =====
  async markFirstVisitComplete(): Promise<void> {
    try {
      if (!auth.currentUser) {
        localStorage.setItem('luxardo_first_visit_completed', 'true');
        return;
      }

      const prefDoc = doc(db, 'userPreferences', auth.currentUser.uid);
      await updateDoc(prefDoc, {
        firstVisitCompleted: true,
        firstVisitCompletedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Failed to mark first visit:', err);
      localStorage.setItem('luxardo_first_visit_completed', 'true');
    }
  },

  async isFirstVisitComplete(): Promise<boolean> {
    try {
      if (!auth.currentUser) {
        return localStorage.getItem('luxardo_first_visit_completed') === 'true';
      }

      const prefDoc = await getDoc(doc(db, 'userPreferences', auth.currentUser.uid));
      return prefDoc.exists() ? (prefDoc.data() as any)?.firstVisitCompleted : false;
    } catch (err) {
      console.error('Failed to check first visit:', err);
      return localStorage.getItem('luxardo_first_visit_completed') === 'true';
    }
  },

  // ===== CLEANUP ON LOGOUT =====
  async clearAllUserData(): Promise<void> {
    try {
      // Clear Firestore data
      if (auth.currentUser) {
        await deleteDoc(doc(db, 'users', auth.currentUser.uid));
        await deleteDoc(doc(db, 'carts', auth.currentUser.uid));
        await deleteDoc(doc(db, 'userPreferences', auth.currentUser.uid));
      }
    } catch (err) {
      console.error('Failed to clear user data:', err);
    } finally {
      // Always clear localStorage fallbacks
      sessionStorage.removeItem('luxardo_cart');
      localStorage.removeItem('luxardo_first_visit_completed');
      localStorage.removeItem('luxardo_temp_preferences');
      localStorage.removeItem('luxardo_temp_wishlist');
      localStorage.removeItem('luxardo_user');
      localStorage.removeItem('luxardo_logged_out');
    }
  },
};
