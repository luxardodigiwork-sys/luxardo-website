import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product } from '../types';
import { useAuth } from './AuthContext';
import { db } from '../firebase';
import { doc, setDoc, deleteDoc, collection, onSnapshot, query, where } from 'firebase/firestore';
import { firebaseStorage } from '../utils/firebaseStorage';

interface WishlistContextType {
  wishlist: Product[];
  addToWishlist: (product: Product) => void;
  removeFromWishlist: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [wishlist, setWishlist] = useState<Product[]>(() => {
    const savedWishlist = localStorage.getItem('LUXARDO FASHION_wishlist');
    if (savedWishlist) {
      try {
        return JSON.parse(savedWishlist);
      } catch (e) {
        console.error('Failed to parse wishlist', e);
      }
    }
    return [];
  });

  // Load from Firestore if user is logged in
  useEffect(() => {
    // ⚡ SAFETY LOCK: User load hone tak wait karein
    if (!user?.id) {
      console.log("Wishlist: No active session, using local storage only.");
      return;
    }
    
    // Query tabhi fire hogi jab user.id 100% available hogi
    const q = query(collection(db, 'favorites'), where('userId', '==', user.id));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const firestoreFavorites = snapshot.docs.map(doc => doc.data().product as Product);
      
      setWishlist(prev => {
        const merged = [...prev];
        
        firestoreFavorites.forEach(fp => {
          if (!merged.some(p => p.id === fp.id)) {
            merged.push(fp);
          }
        });

        // Sync local to Firestore
        prev.forEach(async (localFav) => {
          if (!firestoreFavorites.some(fp => fp.id === localFav.id)) {
            try {
              // user.id check yahan bhi safe hai
              await setDoc(doc(db, 'favorites', `${user.id}_${localFav.id}`), {
                userId: user.id,
                userEmail: user.email || '',
                productId: localFav.id,
                product: localFav,
                createdAt: new Date().toISOString()
              });
            } catch (error) {
              console.error('Error syncing local favorite', error);
            }
          }
        });

        return merged;
      });
    }, (error) => {
      console.error("Wishlist Snapshot Error:", error);
    });

    return () => unsubscribe();
  }, [user?.id]); // Sirf user.id change par trigger hoga

  useEffect(() => {
    localStorage.setItem('LUXARDO FASHION_wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  const addToWishlist = async (product: Product) => {
    if (!isInWishlist(product.id)) {
      setWishlist(prev => [...prev, product]);
      
      if (user?.id) {
        try {
          await setDoc(doc(db, 'favorites', `${user.id}_${product.id}`), {
            userId: user.id,
            userEmail: user.email || '',
            productId: product.id,
            product: product,
            createdAt: new Date().toISOString()
          });
        } catch (error) {
          console.error('Error saving to Firestore', error);
        }
      }
    }
  };

  const removeFromWishlist = async (productId: string) => {
    setWishlist(prev => prev.filter(p => p.id !== productId));
    
    if (user?.id) {
      try {
        await deleteDoc(doc(db, 'favorites', `${user.id}_${productId}`));
      } catch (error) {
        console.error('Error removing from Firestore', error);
      }
    }
  };

  const isInWishlist = (productId: string) => {
    return wishlist.some(p => p.id === productId);
  };

  return (
    <WishlistContext.Provider value={{ wishlist, addToWishlist, removeFromWishlist, isInWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (context === undefined) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
};