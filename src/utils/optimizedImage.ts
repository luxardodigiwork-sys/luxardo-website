/**
 * The "Resize Images" Firebase extension (instance storage-resize-images, asia-south1) writes a WebP copy of every
 * uploaded image to `<original folder>/thumbnails/<name>_800x1200.webp` in the same bucket.
 * This maps a Firebase Storage download URL to that resized copy. Callers must fall back to the original URL
 * when the copy does not exist yet (old uploads, or the extension is still processing).
 */
const RESIZED_DIR = 'thumbnails';
const RESIZED_SUFFIX = '_800x1200.webp';

export function resizedImageUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  let u: URL;
  try { u = new URL(url); } catch { return undefined; }
  if (u.hostname !== 'firebasestorage.googleapis.com') return undefined;
  const m = u.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
  if (!m) return undefined;
  let objectPath: string;
  try { objectPath = decodeURIComponent(m[2]); } catch { return undefined; }
  if (!/\.(jpe?g|png|webp)$/i.test(objectPath)) return undefined;
  if (objectPath.includes(`/${RESIZED_DIR}/`) || objectPath.endsWith(RESIZED_SUFFIX)) return undefined; // already a resized copy
  if (objectPath.startsWith('user-uploads/')) return undefined; // private customer uploads are never rewritten
  const slash = objectPath.lastIndexOf('/');
  const dir = slash >= 0 ? objectPath.slice(0, slash + 1) : '';
  const base = objectPath.slice(slash + 1).replace(/\.[^.]+$/, '');
  const resized = `${dir}${RESIZED_DIR}/${base}${RESIZED_SUFFIX}`;
  return `https://firebasestorage.googleapis.com/v0/b/${m[1]}/o/${encodeURIComponent(resized)}?alt=media`;
}

/** Responsive sources for storefront photos; private/non-Firebase assets are left unchanged. */
export function photo(url: string | null | undefined, kind: 'card' | 'full' | 'hero' = 'card') {
  const original = url || '';
  const small = resizedImageUrl(original);
  if (!small) return { src: original, decoding: 'async' as const };
  const onError = (event: { currentTarget: HTMLImageElement }) => {
    const img = event.currentTarget;
    if (img.getAttribute('src') === original && !img.getAttribute('srcset')) return;
    img.removeAttribute('srcset'); img.removeAttribute('sizes');
    img.src = original;
  };
  return kind === 'card'
    ? { src: small, decoding: 'async' as const, onError }
    : { src: original, srcSet: `${small} 800w, ${original} 2000w`, sizes: kind === 'hero' ? '100vw' : '(min-width: 1024px) 60vw, 100vw', decoding: 'async' as const, onError };
}
