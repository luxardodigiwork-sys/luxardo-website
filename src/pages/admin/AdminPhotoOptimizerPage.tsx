import React, { useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase';
import { compressForWeb } from '../../utils/imageCompress';
import { PHOTO_FIELDS, photoDocumentUrls, publicPhotoPath } from '../../utils/photoMaintenance';
import { replaceDocumentPhotos } from '../../utils/photoMaintenanceStore';
import { syncPublicContent } from '../../utils/contentSync';

type Item = { url: string; name: string; locations: string[]; size: number | null; status: 'candidate' | 'light' | 'working' | 'done' | 'error'; newUrl?: string; newSize?: number; error?: string };
const HEAVY_BYTES = 600 * 1024;
const MAX_BYTES = 50 * 1024 * 1024;
const sizeLabel = (bytes?: number | null) => bytes == null ? 'Size unknown' : `${(bytes / 1024).toFixed(0)} KB`;

/** Adapted from launch/cleanup, with transaction-safe URL replacement and content revision updates. */
export default function AdminPhotoOptimizerPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const patch = (url: string, fields: Partial<Item>) => setItems(prev => prev.map(item => item.url === url ? { ...item, ...fields } : item));
  const scan = async () => {
    setBusy(true); setItems([]); setMessage('Scanning photos...');
    try {
      const found = new Map<string, Item>();
      for (const name of Object.keys(PHOTO_FIELDS)) {
        const snap = await getDocs(collection(db, name));
        for (const row of snap.docs) for (const url of photoDocumentUrls(name, row.data())) {
          const path = publicPhotoPath(url)!;
          const item = found.get(url) ?? { url, name: path.split('/').pop() || path, locations: [], size: null, status: 'candidate' as const };
          item.locations.push(`${name}/${row.id}`); found.set(url, item);
        }
      }
      const list = [...found.values()];
      // Bound network activity: never send a request for every product simultaneously.
      for (let i = 0; i < list.length; i += 4) await Promise.all(list.slice(i, i + 4).map(async item => {
        try {
          const response = await fetch(item.url, { method: 'HEAD', signal: AbortSignal.timeout(15000) });
          if (response.ok) item.size = Number(response.headers.get('content-length')) || null;
        } catch { /* An unknown size can be checked when optimisation is requested. */ }
        if (item.size !== null && item.size <= HEAVY_BYTES) item.status = 'light';
      }));
      setItems(list.sort((a, b) => (b.size ?? 0) - (a.size ?? 0)));
      setMessage(`${list.length} photo(s) scanned. Only heavy or unknown-size photos are candidates.`);
    } catch { setMessage('Scan failed. Check your admin access and connection, then try again.'); }
    finally { setBusy(false); }
  };
  const optimize = async () => {
    setBusy(true); setMessage('Preparing optimised photos...');
    const todo = items.filter(item => item.status === 'candidate' || item.status === 'error');
    const replacements = new Map<string, string>();
    const prepared: Item[] = [];
    try {
      for (const item of todo) {
        patch(item.url, { status: 'working', error: undefined });
        try {
          let newUrl = item.newUrl, newSize = item.newSize;
          if (!newUrl) {
            const response = await fetch(item.url, { signal: AbortSignal.timeout(30000) });
            if (!response.ok) throw new Error('The original photo could not be downloaded.');
            const blob = await response.blob();
            if (blob.size > MAX_BYTES) throw new Error('This photo exceeds 50 MB. Upload a smaller version separately.');
            if (!['image/jpeg', 'image/png', 'image/webp'].includes(blob.type)) throw new Error('Unsupported image type.');
            const file = await compressForWeb(blob, { name: item.name });
            if (file.size >= blob.size) { patch(item.url, { status: 'light', size: blob.size }); continue; }
            const target = ref(storage, `products/optimized/${crypto.randomUUID()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`);
            await uploadBytes(target, file, { contentType: file.type, cacheControl: 'public,max-age=31536000' });
            newUrl = await getDownloadURL(target); newSize = file.size;
          }
          replacements.set(item.url, newUrl);
          prepared.push(item);
          patch(item.url, { newUrl, newSize });
        } catch (error) { patch(item.url, { status: 'error', error: error instanceof Error ? error.message : 'Photo processing failed.' }); }
      }
      let updated = 0;
      const failed = new Set<string>();
      const targets = new Set(prepared.flatMap(item => item.locations));
      for (const target of targets) {
        const slash = target.indexOf('/');
        try { if (await replaceDocumentPhotos(db, target.slice(0, slash), target.slice(slash + 1), replacements)) updated++; }
        catch { failed.add(target); }
      }
      for (const item of prepared) patch(item.url, item.locations.some(target => failed.has(target))
        ? { status: 'error', error: 'Some photo references could not be updated. Retry will reuse the prepared image.' }
        : { status: 'done' });
      await syncPublicContent({ force: true });
      setMessage(`${prepared.length} photo(s) prepared; ${updated} document(s) updated; ${failed.size} document update(s) failed. Original files were kept. Concurrent edits are preserved.`);
    } catch { setMessage('Optimisation stopped. Completed updates remain saved; original files were kept. Scan again before continuing.'); }
    finally { setBusy(false); }
  };
  const count = items.filter(item => item.status === 'candidate' || item.status === 'error').length;
  return <div className="space-y-6">
    <h1 className="text-3xl font-display">Photo Optimizer</h1>
    <p className="text-sm text-brand-secondary max-w-2xl">Prepare lighter copies of existing website photos at up to 2000px. Originals are kept. Scanning makes no changes; optimisation updates only current photo references.</p>
    <div className="flex flex-wrap gap-3"><button disabled={busy} onClick={() => void scan()} className="btn-outline px-5 py-3">Scan photos</button><button disabled={busy || !count} onClick={() => void optimize()} className="btn-primary px-5 py-3 disabled:opacity-50">Optimize {count} photo(s)</button></div>
    {message && <p role="status" className="text-sm">{message}</p>}
    <div className="divide-y border border-brand-divider bg-white">{items.map(item => <div key={item.url} className="flex gap-4 p-4 items-center">
      <img src={item.newUrl || item.url} alt="" loading="lazy" className="w-12 h-16 object-cover" />
      <div className="flex-1 min-w-0"><p className="text-sm truncate">{item.name}</p><p className="text-xs text-brand-secondary">{item.locations.join(', ')}</p>{item.error && <p role="alert" className="text-xs text-red-700">{item.error}</p>}</div>
      <div className="text-xs text-right"><p>{sizeLabel(item.size)}{item.newSize ? ` → ${sizeLabel(item.newSize)}` : ''}</p><p>{item.status === 'done' ? 'Updated' : item.status}</p></div>
    </div>)}</div>
  </div>;
}
