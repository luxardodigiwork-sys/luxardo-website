import React, { useState } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase';
import { compressForWeb } from '../../utils/imageCompress';
import { parseStorageUrl } from '../../utils/images';
import { Loader2, CheckCircle2, AlertTriangle, Zap, Search } from 'lucide-react';

/**
 * Admin → Photo Optimizer
 *
 * Finds every photo the website uses (products, collections, site content,
 * prime content, partners) that is still a heavy original, and replaces it
 * with the same picture at max 2000px WebP. The Resize Images extension then
 * makes the small 800px copy automatically.
 *
 * Safe by design: the original files are NOT deleted, and only the photo
 * links inside the documents change. Running it twice does nothing new.
 */

const SCAN_COLLECTIONS = ['products', 'categories', 'siteContent', 'primeContent', 'partners', 'collections', 'media'];
const HEAVY_BYTES = 600 * 1024;

type Item = {
  url: string;
  path: string;
  name: string;
  size: number | null;
  where: string[];            // "products/LXF-1 · image"
  status: 'ok' | 'heavy' | 'working' | 'done' | 'error';
  newSize?: number;
  newUrl?: string;
  error?: string;
};

const kb = (n?: number | null) =>
  n == null ? '—' : n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;

/** Collect every Firebase Storage URL in a document, with the top-level field it sits in. */
function findUrls(value: unknown, field: string, out: { url: string; field: string }[]) {
  if (typeof value === 'string') {
    if (parseStorageUrl(value)) out.push({ url: value, field });
  } else if (Array.isArray(value)) {
    value.forEach((v) => findUrls(v, field, out));
  } else if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    Object.values(value).forEach((v) => findUrls(v, field, out));
  }
}

/** Replace URL strings inside plain objects/arrays; leaves Timestamps etc. untouched. */
function replaceUrls(value: any, map: Map<string, string>): any {
  if (typeof value === 'string') return map.get(value) ?? value;
  if (Array.isArray(value)) return value.map((v) => replaceUrls(v, map));
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const o: any = {};
    for (const [k, v] of Object.entries(value)) o[k] = replaceUrls(v, map);
    return o;
  }
  return value;
}

export default function AdminPhotoOptimizerPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [scanning, setScanning] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const patch = (url: string, p: Partial<Item>) =>
    setItems((prev) => prev.map((it) => (it.url === url ? { ...it, ...p } : it)));

  const scan = async () => {
    setScanning(true);
    setMessage(null);
    try {
      const byUrl = new Map<string, Item>();
      for (const col of SCAN_COLLECTIONS) {
        const snap = await getDocs(collection(db, col)).catch(() => null);
        snap?.forEach((d) => {
          for (const [field, v] of Object.entries(d.data())) {
            const found: { url: string; field: string }[] = [];
            findUrls(v, field, found);
            for (const f of found) {
              const p = parseStorageUrl(f.url)!;
              if (p.path.includes('/thumbnails/')) continue;
              const it = byUrl.get(f.url) || {
                url: f.url, path: p.path, name: p.path.split('/').pop() || p.path,
                size: null, where: [], status: 'ok' as const,
              };
              const label = `${col}/${d.id} · ${f.field}`;
              if (!it.where.includes(label)) it.where.push(label);
              byUrl.set(f.url, it);
            }
          }
        });
      }
      const list = [...byUrl.values()];
      await Promise.all(list.map(async (it) => {
        try {
          const r = await fetch(it.url, { method: 'HEAD' });
          it.size = Number(r.headers.get('content-length')) || null;
        } catch { it.size = null; }
        it.status = it.size == null || it.size > HEAVY_BYTES ? 'heavy' : 'ok';
      }));
      list.sort((a, b) => (b.size || 0) - (a.size || 0));
      setItems(list);
      const heavy = list.filter((i) => i.status === 'heavy').length;
      setMessage(heavy ? `${heavy} heavy photo(s) found.` : 'All photos are already light. Nothing to do.');
    } catch (e: any) {
      setMessage('Scan failed: ' + (e?.message || e));
    } finally {
      setScanning(false);
    }
  };

  const optimizeAll = async () => {
    setRunning(true);
    const todo = items.filter((i) => i.status === 'heavy' || i.status === 'error');
    const map = new Map<string, string>();
    for (const it of todo) {
      patch(it.url, { status: 'working', error: undefined });
      try {
        const blob = await (await fetch(it.url)).blob();
        const file = await compressForWeb(blob, { name: it.name });
        // Always under products/ so the Resize Images extension makes the 800px copy.
        const newPath = `products/opt_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const sref = ref(storage, newPath);
        await uploadBytes(sref, file, {
          contentType: file.type,
          cacheControl: 'public,max-age=31536000',
          customMetadata: { optimizedFrom: it.path, originalSize: String(blob.size) },
        });
        const newUrl = await getDownloadURL(sref);
        map.set(it.url, newUrl);
        patch(it.url, { status: 'done', newSize: file.size, newUrl });
      } catch (e: any) {
        patch(it.url, { status: 'error', error: e?.message || String(e) });
      }
    }

    // Point the website at the new files — only fields that actually change.
    let docsUpdated = 0;
    if (map.size) {
      for (const col of SCAN_COLLECTIONS) {
        const snap = await getDocs(collection(db, col)).catch(() => null);
        if (!snap) continue;
        for (const d of snap.docs) {
          const data = d.data();
          const changes: Record<string, any> = {};
          for (const [k, v] of Object.entries(data)) {
            const nv = replaceUrls(v, map);
            if (JSON.stringify(nv) !== JSON.stringify(v)) changes[k] = nv;
          }
          if (Object.keys(changes).length) {
            await updateDoc(doc(db, col, d.id), changes);
            docsUpdated++;
          }
        }
      }
    }
    setRunning(false);
    setMessage(`Done: ${map.size} photo(s) optimized, ${docsUpdated} page(s)/product(s) updated. Old files were kept.`);
  };

  const heavyCount = items.filter((i) => i.status === 'heavy' || i.status === 'error').length;
  const before = items.filter((i) => i.newSize).reduce((s, i) => s + (i.size || 0), 0);
  const after = items.filter((i) => i.newSize).reduce((s, i) => s + (i.newSize || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display">Photo Optimizer</h1>
        <p className="text-sm text-brand-secondary mt-2 max-w-2xl">
          Finds heavy photos used on the website and replaces them with the same picture at web size
          (max 2000px, WebP). New uploads are already optimized automatically — this is for older photos.
          Original files are kept.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button onClick={scan} disabled={scanning || running} className="btn-outline inline-flex items-center gap-2 !py-3 !px-6">
          {scanning ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Scan photos
        </button>
        <button onClick={optimizeAll} disabled={!heavyCount || running || scanning} className="btn-primary inline-flex items-center gap-2 !py-3 !px-6 disabled:opacity-40">
          {running ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />} Optimize {heavyCount || ''} photo(s)
        </button>
      </div>

      {message && <p className="text-sm">{message}</p>}
      {before > 0 && (
        <p className="text-sm text-emerald-700">Saved {kb(before - after)} ({kb(before)} → {kb(after)}).</p>
      )}

      {items.length > 0 && (
        <div className="bg-white border border-brand-divider divide-y divide-brand-divider">
          {items.map((it) => (
            <div key={it.url} className="flex items-center gap-4 p-3">
              <img src={it.newUrl || it.url} alt="" loading="lazy" className="w-12 h-16 object-cover bg-brand-bg shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{it.name}</p>
                <p className="text-[11px] text-brand-secondary truncate">{it.where.join(' · ')}</p>
                {it.error && <p className="text-[11px] text-red-600 truncate">{it.error}</p>}
              </div>
              <div className="text-right text-xs shrink-0 w-32">
                <p>{kb(it.size)}{it.newSize ? ` → ${kb(it.newSize)}` : ''}</p>
                <p className="mt-1 inline-flex items-center gap-1">
                  {it.status === 'ok' && <span className="text-brand-secondary">Light</span>}
                  {it.status === 'heavy' && <span className="text-amber-700">Heavy</span>}
                  {it.status === 'working' && <Loader2 size={12} className="animate-spin" />}
                  {it.status === 'done' && <><CheckCircle2 size={12} className="text-emerald-600" /> <span className="text-emerald-700">Done</span></>}
                  {it.status === 'error' && <><AlertTriangle size={12} className="text-red-600" /> <span className="text-red-600">Failed</span></>}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
