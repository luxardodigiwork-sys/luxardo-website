/** Pure URL replacement helpers. Only public image fields are eligible; stock/pricing are never patched. */
export const PHOTO_FIELDS: Record<string, readonly string[]> = {
  products: ['image', 'images'],
  collections: ['image', 'bannerImageUrl', 'heroImageUrl'],
  categories: ['image', 'bannerImageUrl', 'heroImageUrl'],
  siteContent: ['json'],
  primeContent: ['json', 'image', 'images', 'bannerImageUrl', 'heroImageUrl'],
  partners: ['image', 'imageUrl', 'logo', 'logoUrl'],
  media: ['url', 'thumbnail'],
};

export function publicPhotoPath(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'firebasestorage.googleapis.com') return null;
    const match = url.pathname.match(/^\/v0\/b\/[^/]+\/o\/(.+)$/);
    if (!match) return null;
    const path = decodeURIComponent(match[1]);
    if (path.startsWith('user-uploads/') || path.includes('/thumbnails/') || !/\.(jpe?g|png|webp)$/i.test(path)) return null;
    return path;
  } catch { return null; }
}

const plain = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
function parsedObject(value: string): unknown {
  if (!/^[\s]*[\[{]/.test(value)) return null;
  try { const parsed = JSON.parse(value); return plain(parsed) || Array.isArray(parsed) ? parsed : null; } catch { return null; }
}

export function photoUrls(value: unknown, depth = 0): string[] {
  if (depth > 25) return [];
  if (typeof value === 'string') {
    if (publicPhotoPath(value)) return [value];
    const parsed = parsedObject(value);
    return parsed ? photoUrls(parsed, depth + 1) : [];
  }
  if (Array.isArray(value)) return value.flatMap(v => photoUrls(v, depth + 1));
  if (plain(value)) return Object.values(value).flatMap(v => photoUrls(v, depth + 1));
  return [];
}

function replace(value: unknown, urls: ReadonlyMap<string, string>, depth = 0): { value: unknown; changed: boolean } {
  if (depth > 25) return { value, changed: false };
  if (typeof value === 'string') {
    const replacement = urls.get(value);
    if (replacement && publicPhotoPath(value) && publicPhotoPath(replacement)) return { value: replacement, changed: replacement !== value };
    const parsed = parsedObject(value);
    if (parsed) {
      const result = replace(parsed, urls, depth + 1);
      if (result.changed) return { value: JSON.stringify(result.value), changed: true };
    }
    return { value, changed: false };
  }
  if (Array.isArray(value)) {
    const next = value.map(v => replace(v, urls, depth + 1));
    return { value: next.map(v => v.value), changed: next.some(v => v.changed) };
  }
  if (plain(value)) {
    const next = Object.entries(value).map(([key, v]) => [key, replace(v, urls, depth + 1)] as const);
    return { value: Object.fromEntries(next.map(([key, v]) => [key, v.value])), changed: next.some(([, v]) => v.changed) };
  }
  return { value, changed: false };
}

export function photoDocumentUrls(collection: string, data: Record<string, unknown>): string[] {
  return [...new Set((PHOTO_FIELDS[collection] ?? []).flatMap(field => photoUrls(data[field])))];
}

export function photoDocumentPatch(collection: string, data: Record<string, unknown>, urls: ReadonlyMap<string, string>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const field of PHOTO_FIELDS[collection] ?? []) {
    const result = replace(data[field], urls);
    if (result.changed) patch[field] = result.value;
  }
  return patch;
}
