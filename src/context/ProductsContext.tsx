import React, { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { Product } from '../types';
import { productStore, start } from '../utils/productStore';
import { CatalogueState, getCatalogueState, getStorefrontProducts } from '../utils/catalogueState';

interface ProductsContextType {
  /** Every product in Firestore (admin screens). */
  products: Product[];
  /** Customer-facing products only (visible, valid price). */
  storefrontProducts: Product[];
  isLoaded: boolean;
  error: Error | null;
  /** State of the customer-facing catalogue. */
  state: CatalogueState;
}

const ProductsContext = createContext<ProductsContextType | undefined>(undefined);

export function ProductsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => { start(); }, []);

  const products = useSyncExternalStore(productStore.subscribe, productStore.getAll);
  const isLoaded = useSyncExternalStore(productStore.subscribe, productStore.isLoaded);
  const error = useSyncExternalStore(productStore.subscribe, productStore.getError);

  const value = useMemo<ProductsContextType>(() => {
    const storefrontProducts = getStorefrontProducts(products);
    return {
      products,
      storefrontProducts,
      isLoaded,
      error,
      state: getCatalogueState({ isLoaded, error, products: storefrontProducts }),
    };
  }, [products, isLoaded, error]);

  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>;
}

export function useProducts() {
  const ctx = useContext(ProductsContext);
  if (!ctx) throw new Error('useProducts must be used within ProductsProvider');
  return ctx;
}
