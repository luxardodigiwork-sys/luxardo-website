// FILE: src/context/CartContext.tsx
// FIX: Now saves cart data to Firebase instead of localStorage
// Uses Firestore for persistent cart storage across devices

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product } from '../types';
import { storage } from '../utils/localStorage';
import { firebaseStorage } from '../utils/firebaseStorage';
import { auth } from '../firebase';

interface CartItem {
  product: Product;
  quantity: number;
  size?: string;
}

// Only save what's needed to restore cart — not full product with base64 images
interface SavedCartItem {
  productId: string;
  quantity: number;
  size?: string;
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: Product, quantity?: number, size?: string) => void;
  removeFromCart: (productId: string, size?: string) => void;
  updateQuantity: (productId: string, delta: number, size?: string) => void;
  clearCart: () => void;
  cartCount: number;
  cartSubtotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// Save cart to Firebase (with fallback to sessionStorage for anonymous users)
const saveCartToStorage = async (items: CartItem[]) => {
  try {
    const minimal: SavedCartItem[] = items.map(item => ({
      productId: item.product.id,
      quantity: item.quantity,
      size: item.size,
    }));
    
    if (auth.currentUser) {
      await firebaseStorage.saveCart(items);
    } else {
      sessionStorage.setItem('LUXARDO FASHION_cart', JSON.stringify(minimal));
    }
  } catch (e) {
    console.error('Cart save failed:', e);
    try { 
      const minimal = items.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        size: item.size,
      }));
      sessionStorage.setItem('LUXARDO FASHION_cart', JSON.stringify(minimal)); 
    } catch {}
  }
};

// Restore full product objects from saved IDs
const loadCartFromStorage = async (): Promise<CartItem[]> => {
  try {
    // Try Firebase first if user is logged in
    if (auth.currentUser) {
      const cartData = await firebaseStorage.getCart();
      if (cartData) {
        const allProducts = storage.getProducts();
        const restored: CartItem[] = [];
        
        for (const saved of cartData as SavedCartItem[]) {
          const product = allProducts.find(p => p.id === saved.productId);
          if (product) {
            restored.push({
              product,
              quantity: saved.quantity,
              size: saved.size,
            });
          }
        }
        return restored;
      }
    }

    // Fallback to sessionStorage for anonymous users
    const raw = sessionStorage.getItem('LUXARDO FASHION_cart');
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [];

    // Check if old format (full product objects saved) — migrate
    if (parsed[0]?.product) {
      const migrated: CartItem[] = parsed.map((item: any) => ({
        product: item.product,
        quantity: item.quantity,
        size: item.size,
      }));
      // Re-save in new format
      await saveCartToStorage(migrated);
      return migrated;
    }

    // New format: only IDs saved — restore from products store
    const allProducts = storage.getProducts();
    const restored: CartItem[] = [];

    for (const saved of parsed as SavedCartItem[]) {
      const product = allProducts.find(p => p.id === saved.productId);
      if (product) {
        restored.push({
          product,
          quantity: saved.quantity,
          size: saved.size,
        });
      }
    }
    return restored;
  } catch (e) {
    console.error('Cart load failed, resetting:', e);
    try { sessionStorage.removeItem('LUXARDO FASHION_cart'); } catch {}
    return [];
  }
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load cart from Firebase on mount
  useEffect(() => {
    const initCart = async () => {
      try {
        const items = await loadCartFromStorage();
        setCartItems(items);
      } catch (err) {
        console.error('Failed to initialize cart:', err);
        setCartItems([]);
      } finally {
        setIsLoading(false);
      }
    };
    initCart();
  }, []);

  // Save cart to Firebase whenever it changes (after initial load)
  useEffect(() => {
    if (!isLoading) {
      saveCartToStorage(cartItems);
    }
  }, [cartItems, isLoading]);

  const addToCart = (product: Product, quantity: number = 1, size?: string) => {
    setCartItems(prev => {
      const existing = prev.find(
        item => item.product.id === product.id && item.size === size
      );
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id && item.size === size
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity, size }];
    });
  };

  const removeFromCart = (productId: string, size?: string) => {
    setCartItems(prev =>
      prev.filter(item => !(item.product.id === productId && item.size === size))
    );
  };

  const updateQuantity = (productId: string, delta: number, size?: string) => {
    setCartItems(prev =>
      prev.map(item => {
        if (item.product.id === productId && item.size === size) {
          return { ...item, quantity: Math.max(1, item.quantity + delta) };
        }
        return item;
      })
    );
  };

  const clearCart = async () => {
    setCartItems([]);
    try { 
      await firebaseStorage.clearCart();
      sessionStorage.removeItem('LUXARDO FASHION_cart'); 
    } catch {}
  };

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cartItems.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        cartCount,
        cartSubtotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};