import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { storage } from './localStorage';
import { POLICY_OVERRIDES_KEY } from './policyStore';
import { POLICY_VERSION } from '../policies';
import { COLLECTIONS } from '../constants';
import {
  AdminCollection, StorefrontCollection, cleanCollectionForFirestore, parsePublished,
  serialiseForPublish, toStorefrontCollections, usablePolicyOverrides,
} from './contentModel';

/**
 * Site content (home/about text, policy edits, collections) is stored in Firestore so that what an admin saves is what
 * every visitor sees. The browser keeps a copy in localStorage, which the existing pages already read synchronously;
 * `syncPublicContent()` refreshes that copy from Firestore at page load and tells the app to re-render once if it changed.
 * Rules: public read, admin-only write (firestore.rules).
 */
export const CONTENT_EVENT = 'luxardo:content-updated';
const COLLECTIONS_KEY = 'LUXARDO FASHION_admin_collections';
const COLLECTIONS_FLAG = 'LUXARDO_collections_synced';
const SITE_KEY = 'LUXARDO FASHION_site_content';

const read = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* quota: ignore, Firestore stays the source of truth */ } };

/** Collections shown on the storefront: the admin-managed list once it exists, otherwise the shipped defaults. */
export function getStorefrontCollections(): StorefrontCollection[] {
  if (read(COLLECTIONS_FLAG) === '1') {
    const raw = read(COLLECTIONS_KEY);
    try { return toStorefrontCollections(raw ? JSON.parse(raw) : []); } catch { return []; }
  }
  return COLLECTIONS as unknown as StorefrontCollection[];
}

let syncing: Promise<void> | null = null;

/** Pulls published content from Firestore into the local copy. Never throws; the storefront falls back to what it has. */
export function syncPublicContent(): Promise<void> {
  if (syncing) return syncing;
  syncing = (async () => {
    let changed = false;
    try {
      const [site, pol, cols, meta] = await Promise.all([
        getDoc(doc(db, 'siteContent', 'main')),
        getDoc(doc(db, 'policies', 'main')),
        getDocs(collection(db, 'collections')),
        getDoc(doc(db, 'siteContent', 'collectionsMeta')),
      ]);
      if (site.exists()) {
        const content = parsePublished<Record<string, unknown>>(site.data().json);
        if (content && typeof content === 'object') {
          const before = read(SITE_KEY);
          storage.saveSiteContent(content);
          if (read(SITE_KEY) !== before) changed = true;
        }
      }
      if (pol.exists()) {
        const o = usablePolicyOverrides(parsePublished(pol.data().json), POLICY_VERSION);
        const next = o && Object.keys(o.overrides).length ? JSON.stringify(o) : null;
        const before = read(POLICY_OVERRIDES_KEY);
        if (next) write(POLICY_OVERRIDES_KEY, next);
        else if (o) { try { localStorage.removeItem(POLICY_OVERRIDES_KEY); } catch { /* ignore */ } }
        if (read(POLICY_OVERRIDES_KEY) !== before) changed = true;
      }
      if (meta.exists() || cols.size > 0) {
        const list = cols.docs.map((d) => d.data() as AdminCollection).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        const before = read(COLLECTIONS_KEY) + read(COLLECTIONS_FLAG);
        write(COLLECTIONS_KEY, JSON.stringify(list));
        write(COLLECTIONS_FLAG, '1');
        if (read(COLLECTIONS_KEY) + read(COLLECTIONS_FLAG) !== before) changed = true;
      }
    } catch (e) {
      console.warn('Content sync failed (using the local copy):', e);
    }
    if (changed) window.dispatchEvent(new Event(CONTENT_EVENT));
  })();
  return syncing;
}

/** Re-renders the caller when synced content changed (used by the layouts to refresh the page once). */
export function useContentVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    window.addEventListener(CONTENT_EVENT, bump);
    void syncPublicContent();
    return () => window.removeEventListener(CONTENT_EVENT, bump);
  }, []);
  return version;
}

const stamp = () => ({ updatedAt: new Date().toISOString(), updatedBy: auth.currentUser?.uid ?? null });

/** Admin: save site content to Firestore (and the local copy). Throws with a readable message on failure. */
export async function publishSiteContent(content: unknown): Promise<void> {
  const s = serialiseForPublish(content);
  if (s.ok === false) throw new Error(s.error);
  await setDoc(doc(db, 'siteContent', 'main'), { json: s.json, ...stamp() });
  storage.saveSiteContent(content as any);
}

/** Admin: publish the policy edits currently held locally (call after storage.savePolicies / resetPolicies). */
export async function publishPolicies(): Promise<void> {
  let overrides: { version: string; overrides: Record<string, unknown> } = { version: POLICY_VERSION, overrides: {} };
  const raw = read(POLICY_OVERRIDES_KEY);
  if (raw) { const p = parsePublished<typeof overrides>(raw); if (p && p.version === POLICY_VERSION) overrides = p; }
  const s = serialiseForPublish(overrides);
  if (s.ok === false) throw new Error(s.error);
  await setDoc(doc(db, 'policies', 'main'), { json: s.json, ...stamp() });
}

/** Admin: replace the published collection list (add / edit / delete / reorder). */
export async function publishCollections(list: AdminCollection[]): Promise<void> {
  const clean = list.map(cleanCollectionForFirestore);
  const ids = new Set(clean.map((c) => c.id));
  if (ids.size !== clean.length) throw new Error('Two collections have the same id.');
  const existing = await getDocs(collection(db, 'collections'));
  const batch = writeBatch(db);
  clean.forEach((c) => batch.set(doc(db, 'collections', c.id), c));
  existing.docs.forEach((d) => { if (!ids.has(d.id)) batch.delete(d.ref); });
  batch.set(doc(db, 'siteContent', 'collectionsMeta'), { initialized: true, ...stamp() });
  await batch.commit();
  write(COLLECTIONS_KEY, JSON.stringify(clean));
  write(COLLECTIONS_FLAG, '1');
}
