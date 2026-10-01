import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, orderBy, onSnapshot, Unsubscribe, Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { Product } from '../types';
import { storage } from './localStorage';

const PRODUCTS = 'products';

/** Fetch all products from Firestore (with localStorage fallback). */
export async function fetchProductsFromFirestore(): Promise<Product[]> {
  try {
    const snap = await getDocs(query(collection(db, PRODUCTS), orderBy('createdAt', 'desc')));
    if (snap.empty) {
      console.log('[Products] Firestore empty, using localStorage fallback');
      return storage.getProducts();
    }
    const products = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
    // Cache to localStorage
    storage.saveProducts(products);
    console.log(`[Products] Synced ${products.length} from Firestore`);
    return products;
  } catch (err) {
    console.warn('[Products] Firestore fetch failed, using localStorage:', err);
    return storage.getProducts();
  }
}

/** Subscribe to products real-time updates. */
export function subscribeProducts(callback: (products: Product[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, PRODUCTS), orderBy('createdAt', 'desc')),
    (snap) => {
      const products = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
      storage.saveProducts(products);
      callback(products);
    },
    (err) => console.error('[Products] Subscription error:', err)
  );
}

/** Save (create or update) a product in Firestore. */
export async function saveProductToFirestore(product: Product): Promise<void> {
  const id = product.id || `prod_${Date.now()}`;
  const data = {
    ...product,
    id,
    createdAt: product.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await setDoc(doc(db, PRODUCTS, id), data, { merge: true });
  
  // Update localStorage cache
  const products = storage.getProducts();
  const existingIdx = products.findIndex(p => p.id === id);
  if (existingIdx >= 0) products[existingIdx] = data as Product;
  else products.unshift(data as Product);
  storage.saveProducts(products);
  
  console.log(`[Products] Saved: ${id}`);
}

/** Delete a product from Firestore. */
export async function deleteProductFromFirestore(productId: string): Promise<void> {
  await deleteDoc(doc(db, PRODUCTS, productId));
  
  // Update localStorage cache
  const products = storage.getProducts().filter(p => p.id !== productId);
  storage.saveProducts(products);
  
  console.log(`[Products] Deleted: ${productId}`);
}

/** Fetch a single product by ID. */
export async function getProductFromFirestore(productId: string): Promise<Product | null> {
  try {
    const snap = await getDoc(doc(db, PRODUCTS, productId));
    if (snap.exists()) return { id: snap.id, ...snap.data() } as Product;
  } catch (err) {
    console.warn('[Products] Single fetch failed, trying localStorage:', err);
  }
  return storage.getProducts().find(p => p.id === productId) || null;
}
