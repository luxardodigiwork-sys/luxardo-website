import { Firestore, doc, runTransaction } from 'firebase/firestore';
import { PHOTO_FIELDS, photoDocumentPatch } from './photoMaintenance';
import { revOf } from './contentPublish';

/** Re-read the latest document inside the transaction: never restore stale stock, text or URLs. */
export async function replaceDocumentPhotos(fs: Firestore, collection: string, id: string, urls: ReadonlyMap<string, string>): Promise<boolean> {
  if (!Object.hasOwn(PHOTO_FIELDS, collection)) throw new Error('Unsupported photo collection.');
  const ref = doc(fs, collection, id);
  const collectionMeta = collection === 'collections' ? doc(fs, 'siteContent', 'collectionsMeta') : null;
  return runTransaction(fs, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return false;
    const patch = photoDocumentPatch(collection, snap.data(), urls);
    if (!Object.keys(patch).length) return false;
    if (typeof patch.json === 'string' && new TextEncoder().encode(patch.json).length > 900000) throw new Error('Updated content is too large.');
    const meta = collectionMeta ? await tx.get(collectionMeta) : null;
    const updatedAt = new Date().toISOString();
    if (collection === 'siteContent') patch.rev = revOf(snap.data()) + 1;
    tx.update(ref, { ...patch, updatedAt });
    if (collectionMeta) tx.set(collectionMeta, { rev: revOf(meta?.data()) + 1, updatedAt }, { merge: true });
    return true;
  });
}
