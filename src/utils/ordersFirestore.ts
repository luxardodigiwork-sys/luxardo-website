import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot, Unsubscribe, addDoc, serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Order } from '../types';
import { storage } from './localStorage';

const ORDERS = 'orders';

/** Save a new order to Firestore. */
export async function createOrderInFirestore(orderData: Omit<Order, 'id'>): Promise<string> {
  const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
  const userId = auth.currentUser?.uid || orderData.userId || 'guest';
  
  const fullOrder = {
    ...orderData,
    id: orderId,
    userId,
    createdAt: new Date().toISOString(),
    status: orderData.status || 'pending',
    paymentStatus: orderData.paymentStatus || 'pending',
  };
  
  await setDoc(doc(db, ORDERS, orderId), fullOrder);
  
  // Also save to localStorage for backward compatibility
  const orders = storage.getOrders();
  orders.unshift(fullOrder as Order);
  storage.saveOrders(orders);
  
  console.log(`[Orders] Created: ${orderId}`);
  return orderId;
}

/** Get all orders (admin only). */
export async function getAllOrdersFromFirestore(): Promise<Order[]> {
  try {
    const snap = await getDocs(query(collection(db, ORDERS), orderBy('createdAt', 'desc')));
    if (snap.empty) {
      console.log('[Orders] Firestore empty, using localStorage');
      return storage.getOrders();
    }
    const orders = snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
    storage.saveOrders(orders);
    return orders;
  } catch (err) {
    console.warn('[Orders] Firestore fetch failed:', err);
    return storage.getOrders();
  }
}

/** Get user's own orders. */
export async function getUserOrdersFromFirestore(userId: string): Promise<Order[]> {
  try {
    const snap = await getDocs(
      query(collection(db, ORDERS), where('userId', '==', userId), orderBy('createdAt', 'desc'))
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
  } catch (err) {
    console.warn('[Orders] User fetch failed:', err);
    return storage.getOrders().filter(o => o.userId === userId);
  }
}

/** Subscribe to real-time orders updates (admin). */
export function subscribeOrders(callback: (orders: Order[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, ORDERS), orderBy('createdAt', 'desc')),
    (snap) => {
      const orders = snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
      storage.saveOrders(orders);
      callback(orders);
    },
    (err) => console.error('[Orders] Subscription error:', err)
  );
}

/** Update order status. */
export async function updateOrderStatusInFirestore(orderId: string, updates: Partial<Order>): Promise<void> {
  await updateDoc(doc(db, ORDERS, orderId), {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
  
  // Update localStorage
  const orders = storage.getOrders();
  const idx = orders.findIndex(o => o.id === orderId);
  if (idx >= 0) {
    orders[idx] = { ...orders[idx], ...updates } as Order;
    storage.saveOrders(orders);
  }
  
  console.log(`[Orders] Updated: ${orderId}`);
}
