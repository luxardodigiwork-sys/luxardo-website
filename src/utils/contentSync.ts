import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { storage } from './localStorage';
import { POLICY_OVERRIDES_KEY } from './policyStore';
import { POLICY_VERSION } from '../policies';
import { COLLECTIONS } from '../constants';
import {
  AdminCollection, StorefrontCollection, adminCollectionsFromStorefront, cleanCollectionForFirestore, parsePublished,
  serialiseForPublish, toStorefrontCollections, usablePolicyOverrides,
} from './contentModel';
import { newRemoteState, publishCollectionList, publishJsonDoc, revOf } from './contentPublish';
export { describePublishError } from './contentPublish';

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

/**
 * The list the collections admin page edits: the published list once one exists; before that the storefront's current
 * collections (same ids/URLs). `isDefault` = nothing has been published yet, so saving will publish these for the first time.
 */
export function getAdminCollections(): { list: AdminCollection[]; isDefault: boolean } {
  if (read(COLLECTIONS_FLAG) === '1') {
    const raw = read(COLLECTIONS_KEY);
    try { const l = raw ? JSON.parse(raw) : []; return { list: Array.isArray(l) ? l : [], isDefault: false }; } catch { return { list: [], isDefault: false }; }
  }
  return { list: adminCollectionsFromStorefront(COLLECTIONS as unknown as StorefrontCollection[]), isDefault: true };
}

let syncing: Promise<void> | null = null;
let runSeq = 0;
let retryCount = 0;
const SYNC_TIMEOUT_MS = 15000;
const MAX_BACKGROUND_RETRIES = 3;

/** Revisions seen by the last fully successful sync. Admin saves are only allowed on top of these (see contentPublish.ts). */
const remote = newRemoteState();
export type SyncStatus = 'loading' | 'ready' | 'failed';
let syncStatus: SyncStatus = 'loading';
export const SYNC_STATUS_EVENT = 'luxardo:content-sync-status';
export const getSyncStatus = (): SyncStatus => syncStatus;
const setStatus = (s: SyncStatus) => { syncStatus = s; remote.ready = s === 'ready'; window.dispatchEvent(new Event(SYNC_STATUS_EVENT)); };

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Content sync timed out')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });

/**
 * Pulls published content from Firestore into the local copy. Never throws; the storefront falls back to what it has.
 * A hung or failed sync never sticks: it times out, is forgotten so the next call (or the admin Retry button) starts a fresh
 * one, and public pages retry quietly a few times. `force` re-reads after a success. Only the newest run may change state.
 */
export function syncPublicContent(opts: { force?: boolean } = {}): Promise<void> {
  if (syncing && !opts.force) return syncing;
  const id = ++runSeq;
  setStatus('loading');
  const run = (async () => {
    await Promise.resolve(); // `syncing` must be assigned before any failure path can clear it
    let changed = false;
    try {
      const [site, pol, cols, meta] = await withTimeout(Promise.all([
        getDoc(doc(db, 'siteContent', 'main')),
        getDoc(doc(db, 'policies', 'main')),
        getDocs(collection(db, 'collections')),
        getDoc(doc(db, 'siteContent', 'collectionsMeta')),
      ]), SYNC_TIMEOUT_MS);
      if (id !== runSeq) return; // a newer sync superseded this one
      const nextRev = { site: revOf(site.data()), policies: revOf(pol.data()), collections: revOf(meta.data()) };
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
      Object.assign(remote, nextRev, { collectionIds: cols.docs.map((d) => d.id) });
      retryCount = 0;
      setStatus('ready');
    } catch (e) {
      console.warn('Content sync failed (using the local copy):', e);
      if (id !== runSeq) return;
      setStatus('failed');
      syncing = null; // allow a retry
      if (retryCount < MAX_BACKGROUND_RETRIES) {
        const delay = 5000 * 3 ** retryCount++;
        setTimeout(() => { if (!syncing) void syncPublicContent(); }, delay);
      }
    }
    if (changed) window.dispatchEvent(new Event(CONTENT_EVENT));
  })();
  syncing = run;
  return run;
}

/** Admin pages: whether saving is allowed (initial sync finished successfully) plus a retry for a failed sync. */
export function useSyncStatus(): { status: SyncStatus; retry: () => void } {
  const [status, setS] = useState<SyncStatus>(syncStatus);
  useEffect(() => {
    const on = () => setS(syncStatus);
    window.addEventListener(SYNC_STATUS_EVENT, on);
    void syncPublicContent();
    on();
    return () => window.removeEventListener(SYNC_STATUS_EVENT, on);
  }, []);
  return { status, retry: () => { retryCount = 0; void syncPublicContent(); } };
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

/** Admin: save site content to Firestore (and the local copy). Throws with a readable message on failure or conflict. */
export async function publishSiteContent(content: unknown): Promise<void> {
  const s = serialiseForPublish(content);
  if (s.ok === false) throw new Error(s.error);
  await publishJsonDoc(db, remote, 'site', ['siteContent', 'main'], s.json, stamp());
  storage.saveSiteContent(content as any);
}

/** Admin: publish the policy edits currently held locally (call after storage.savePolicies / resetPolicies). */
export async function publishPolicies(): Promise<void> {
  let overrides: { version: string; overrides: Record<string, unknown> } = { version: POLICY_VERSION, overrides: {} };
  const raw = read(POLICY_OVERRIDES_KEY);
  if (raw) { const p = parsePublished<typeof overrides>(raw); if (p && p.version === POLICY_VERSION) overrides = p; }
  const s = serialiseForPublish(overrides);
  if (s.ok === false) throw new Error(s.error);
  await publishJsonDoc(db, remote, 'policies', ['policies', 'main'], s.json, stamp());
}

/** Admin: replace the published collection list (add / edit / delete / reorder). */
export async function publishCollections(list: AdminCollection[], opts: { allowEmpty?: boolean } = {}): Promise<void> {
  await publishCollectionList(db, remote, list, stamp(), opts);
  write(COLLECTIONS_KEY, JSON.stringify(list.map(cleanCollectionForFirestore)));
  write(COLLECTIONS_FLAG, '1');
}
