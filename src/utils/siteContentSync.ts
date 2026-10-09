import { doc, getDoc, setDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';
import { storage } from './localStorage';

const SITE_CONTENT_DOC = 'main';
const SITE_CONTENT_COLLECTION = 'siteContent';

/**
 * Fetch site content from Firestore on app load.
 * Updates localStorage so existing storage.getSiteContent() returns fresh data.
 */
export async function syncSiteContentFromFirestore(): Promise<void> {
  try {
    const docRef = doc(db, SITE_CONTENT_COLLECTION, SITE_CONTENT_DOC);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const firestoreContent = docSnap.data();
      // Save to localStorage so storage.getSiteContent() returns this
      storage.saveSiteContent(firestoreContent as any);
      console.log('[SiteContent] Synced from Firestore');
    } else {
      console.log('[SiteContent] No Firestore doc yet — using localStorage/defaults');
    }
  } catch (err) {
    console.warn('[SiteContent] Firestore sync failed (using localStorage):', err);
  }
}

/**
 * Save site content to Firestore (admin action).
 * Writes to localStorage too so admin sees changes immediately.
 */
export async function saveSiteContentToFirestore(content: any): Promise<void> {
  // Write to localStorage first (immediate)
  storage.saveSiteContent(content);
  
  // Write to Firestore (visible to all visitors after refresh)
  const docRef = doc(db, SITE_CONTENT_COLLECTION, SITE_CONTENT_DOC);
  await setDoc(docRef, content, { merge: true });
  console.log('[SiteContent] Saved to Firestore');
}

/**
 * Subscribe to real-time site content updates from Firestore.
 * Use in components that need live updates without refresh.
 * Returns unsubscribe function.
 */
export function subscribeSiteContent(callback: (content: any) => void): Unsubscribe {
  const docRef = doc(db, SITE_CONTENT_COLLECTION, SITE_CONTENT_DOC);
  return onSnapshot(docRef, (snap) => {
    if (snap.exists()) {
      const content = snap.data();
      storage.saveSiteContent(content as any);
      callback(content);
    }
  }, (err) => {
    console.error('[SiteContent] Subscription error:', err);
  });
}
