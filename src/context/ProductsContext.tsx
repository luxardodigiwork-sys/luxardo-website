import React, { createContext, useContext, useEffect, useState } from 'react';
import { Product } from '../types';
import { subscribeProducts } from '../utils/productsFirestore';
import { storage } from '../utils/localStorage';

interface ProductsContextType {
  products: Product[];
  isLoading: boolean;
  error: string | null;
}

const ProductsContext = createContext<ProductsContextType | undefined>(undefined);

/**
 * Global single-source-of-truth for products.
 * - Subscribes to Firestore `/products` once on mount
 * - Pushes every change to all consumers in real time
 * - Falls back to localStorage cache only if subscription fails
 * - Writes cache transparently so even refresh-with-broken-network can still render
 */
export function ProductsProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);

    // Optional: instant first-paint from cache while subscription warms up
    try {
      const cached = storage.getProducts();
      if (cached?.length) setProducts(cached);
    } catch {}

    const unsub = subscribeProducts((fresh) => {
      if (!mounted) return;
      setProducts(fresh);
      setIsLoading(false);
      setError(null);
      // Cache for offline / first-paint next time
      try { storage.saveProducts(fresh); } catch {}
    });

    // Safety: if subscription never fires (network), stop spinner after 5s
    const timeout = setTimeout(() => {
      if (mounted) setIsLoading(false);
    }, 5000);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      try { unsub(); } catch {}
    };
  }, []);

  return (
    <ProductsContext.Provider value={{ products, isLoading, error }}>
      {children}
    </ProductsContext.Provider>
  );
}

export function useProducts() {
  const ctx = useContext(ProductsContext);
  if (!ctx) throw new Error('useProducts must be used within ProductsProvider');
  return ctx;
}
