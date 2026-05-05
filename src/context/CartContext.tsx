// FILE: src/context/CartContext.tsx
// FIX: Saves only essential cart data (not full product objects with base64 images)
// This prevents localStorage quota exceeded crash when multiple products are added

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product } from '../types';
import { storage } from '../utils/localStorage';

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

// Save only IDs and quantities — not full product objects
const saveCartToStorage = (items: CartItem[]) => {
  try {
    const minimal: SavedCartItem[] = items.map(item => ({
      productId: item.product.id,
      quantity: item.quantity,
      size: item.size,
    }));
    localStorage.setItem('luxardo_cart', JSON.stringify(minimal));
  } catch (e) {
    // If even minimal save fails, clear to prevent stuck state
    console.error('Cart save failed:', e);
    try { localStorage.removeItem('luxardo_cart'); } catch {}
  }
};

// Restore full product objects from saved IDs
const loadCartFromStorage = (): CartItem[] => {
  try {
    const raw = localStorage.getItem('luxardo_cart');
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [];

    // Check if old format (full product objects saved) — migrate
    if (parsed[0]?.product) {
      // Old format: had full product object — extract minimal and re-save
      const migrated: CartItem[] = parsed.map((item: any) => ({
        product: item.product,
        quantity: item.quantity,
        size: item.size,
      }));
      saveCartToStorage(migrated); // re-save in new format
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
    try { localStorage.removeItem('luxardo_cart'); } catch {}
    return [];
  }
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>(() => loadCartFromStorage());

  // Save minimal data on every cart change
  useEffect(() => {
    saveCartToStorage(cartItems);
  }, [cartItems]);

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

  const clearCart = () => {
    setCartItems([]);
    try { localStorage.removeItem('luxardo_cart'); } catch {}
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