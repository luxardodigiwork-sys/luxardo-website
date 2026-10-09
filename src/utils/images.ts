/**
 * Product / banner photos — always ask for the right size.
 *
 * How photos are stored:
 *  - Admin uploads are resized in the browser to max 2000px WebP
 *    (ImageUploadInput), so the original is a few hundred KB.
 *  - The Firebase "Resize Images" extension then saves a small copy next to
 *    it: products/thumbnails/<name>_800x1200.webp (usually 30–120 KB).
 *
 * How the site uses them:
 *  - 'card'  (product grids, thumbnails, cart, search) -> the 800px copy only.
 *  - 'full'  (main product photo)  -> browser picks 800px or 2000px by screen.
 *  - 'hero'  (full-width banners)  -> same, sized for the full screen width.
 *  If the small copy doesn't exist (older photos, other folders), the image
 *  quietly falls back to the original — nothing breaks, it's just slower
 *  until Admin → Photo Optimizer has been run.
 */
import type React from 'react';

const STORAGE_HOST = 'firebasestorage.googleapis.com';
export const THUMB_SUFFIX = '_800x1200.webp';

type Parsed = { origin: string; bucket: string; path: string };

export function parseStorageUrl(url?: string | null): Parsed | null {
  if (!url) return null;
  // Firebase Storage download links (real or local emulator) look like
  // <origin>/v0/b/<bucket>/o/<url-encoded path>?alt=media[&token=…]
  const m = url.match(/^(https?:\/\/[^/]+)\/v0\/b\/([^/]+)\/o\/([^?#]+)/);
  if (!m) return null;
  try {
    return { origin: m[1], bucket: m[2], path: decodeURIComponent(m[3]) };
  } catch {
    return null;
  }
}

export function storagePublicUrl(bucket: string, path: string, origin = `https://${STORAGE_HOST}`): string {
  return `${origin}/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
}

/** URL of the 800px WebP copy made by the Resize Images extension, or null. */
export function thumbUrl(url?: string | null): string | null {
  const p = parseStorageUrl(url);
  if (!p) return null;
  if (p.path.includes('/thumbnails/')) return url!; // already the small copy
  const slash = p.path.lastIndexOf('/');
  const dir = slash >= 0 ? p.path.slice(0, slash) : '';
  const file = p.path.slice(slash + 1).replace(/\.[^.]+$/, '');
  return storagePublicUrl(p.bucket, `${dir ? dir + '/' : ''}thumbnails/${file}${THUMB_SUFFIX}`, p.origin);
}

export type PhotoKind = 'card' | 'full' | 'hero';

type ImgProps = Pick<
  React.ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'srcSet' | 'sizes' | 'onError' | 'decoding'
>;

/** Falls back once to the original photo if the small copy is missing. */
function fallbackTo(original: string): React.ReactEventHandler<HTMLImageElement> {
  return (e) => {
    const img = e.currentTarget;
    if (img.dataset.lxFallback) return;
    img.dataset.lxFallback = '1';
    img.removeAttribute('srcset');
    img.removeAttribute('sizes');
    img.src = original;
  };
}

/**
 * Spread onto <img> / <motion.img>:  <img {...photo(url, 'card')} alt=… />
 * Non-Firebase URLs (Unsplash, /logo.png, data:) are passed through unchanged.
 */
export function photo(url: string | undefined | null, kind: PhotoKind = 'card'): ImgProps {
  const original = url || '';
  const small = thumbUrl(original);
  if (!small || small === original) return { src: original, decoding: 'async' };

  if (kind === 'card') {
    return { src: small, decoding: 'async', onError: fallbackTo(original) };
  }
  return {
    src: original,
    srcSet: `${small} 800w, ${original} 2000w`,
    sizes: kind === 'hero' ? '100vw' : '(min-width: 1024px) 60vw, 100vw',
    decoding: 'async',
    onError: fallbackTo(original),
  };
}
