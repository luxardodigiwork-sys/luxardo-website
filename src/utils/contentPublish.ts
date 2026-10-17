import { Firestore, collection, doc, runTransaction } from 'firebase/firestore';
import { AdminCollection, cleanCollectionForFirestore } from './contentModel';

/**
 * Optimistic-concurrency publishing for admin-managed content. Each published document carries a numeric `rev`
 * (missing = 0). An admin may only publish on top of the revision their last SUCCESSFUL sync saw; if someone else
 * published in between (or this tab is stale) the transaction aborts instead of overwriting their work.
 * No Firebase app import here: the Firestore instance is passed in, so the logic is testable against the emulator.
 */
export type PublishErrorCode = 'sync-not-ready' | 'conflict' | 'empty-list' | 'invalid';
export class PublishError extends Error {
  code: PublishErrorCode;
  constructor(code: PublishErrorCode, message: string) { super(message); this.name = 'PublishError'; this.code = code; }
}

export interface RemoteState {
  /** True only after a sync in which every document was read successfully (missing documents count as read). */
  ready: boolean;
  site: number; policies: number; collections: number;
  /** Collection ids the admin's last sync saw. Publishing may delete only these. */
  collectionIds: string[];
}
export const newRemoteState = (): RemoteState => ({ ready: false, site: 0, policies: 0, collections: 0, collectionIds: [] });

export const revOf = (data: Record<string, unknown> | undefined | null): number => {
  const n = Number(data?.rev);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

const NOT_READY = 'Content has not finished loading from the server, so saving is disabled. Wait a moment or press Retry.';
const CONFLICT = 'This content was changed by someone else (or in another tab) after you opened it. Nothing was saved, to avoid overwriting their changes. Reload the page, check the latest version, then make your change again.';

function assertReady(state: RemoteState): void {
  if (!state.ready) throw new PublishError('sync-not-ready', NOT_READY);
}

type Stamp = Record<string, unknown>;

/** Publishes a `{json}` document (site content or policies) only if its revision is still the one the admin loaded. */
export async function publishJsonDoc(
  fs: Firestore, state: RemoteState, key: 'site' | 'policies', path: [string, string], json: string, stamp: Stamp,
): Promise<void> {
  assertReady(state);
  const ref = doc(fs, path[0], path[1]);
  const next = await runTransaction(fs, async (tx) => {
    const snap = await tx.get(ref);
    const remote = snap.exists() ? revOf(snap.data()) : 0;
    if (remote !== state[key]) throw new PublishError('conflict', CONFLICT);
    tx.set(ref, { json, rev: remote + 1, ...stamp });
    return remote + 1;
  });
  state[key] = next;
}

/**
 * Replaces the published collection list. The `collectionsMeta` revision is the lock. Deletes are limited to ids this admin
 * saw at sync time, and publishing an empty list over a non-empty one needs `allowEmpty` (an explicit delete of the last one).
 */
export async function publishCollectionList(
  fs: Firestore, state: RemoteState, list: AdminCollection[], stamp: Stamp, opts: { allowEmpty?: boolean } = {},
): Promise<void> {
  assertReady(state);
  const clean = list.map(cleanCollectionForFirestore);
  if (clean.some((c) => !c.id || !c.name.trim())) throw new PublishError('invalid', 'Every collection needs a name.');
  const ids = new Set(clean.map((c) => c.id));
  if (ids.size !== clean.length) throw new PublishError('invalid', 'Two collections have the same id.');
  const slugs = clean.map((c) => c.slug || c.id);
  if (new Set(slugs).size !== slugs.length) throw new PublishError('invalid', 'Two collections have the same URL (slug).');
  if (!clean.length && state.collectionIds.length && !opts.allowEmpty) {
    throw new PublishError('empty-list', 'Refusing to publish an empty collection list over existing collections.');
  }
  if (clean.length + state.collectionIds.length > 400) throw new PublishError('invalid', 'Too many collections for one save.');
  const metaRef = doc(fs, 'siteContent', 'collectionsMeta');
  const toDelete = state.collectionIds.filter((id) => !ids.has(id));
  const next = await runTransaction(fs, async (tx) => {
    const meta = await tx.get(metaRef);
    const remote = meta.exists() ? revOf(meta.data()) : 0;
    if (remote !== state.collections) throw new PublishError('conflict', CONFLICT);
    clean.forEach((c) => tx.set(doc(collection(fs, 'collections'), c.id), c));
    toDelete.forEach((id) => tx.delete(doc(collection(fs, 'collections'), id)));
    tx.set(metaRef, { initialized: true, rev: remote + 1, ...stamp });
    return remote + 1;
  });
  state.collections = next;
  state.collectionIds = clean.map((c) => c.id);
}

/** Readable text for an error thrown by a publish call, or null when it is not one of ours. */
export function describePublishError(e: unknown): string | null {
  return e instanceof PublishError || (e as { name?: string })?.name === 'PublishError' ? String((e as Error).message) : null;
}
