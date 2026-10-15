/** Pure helpers for admin-managed site content (no Firebase import, unit tested). */
export interface AdminCollection {
  id: string; name: string; slug: string; shortDescription: string; longDescription: string;
  bannerImageUrl: string; heroImageUrl: string; isVisible: boolean; sortOrder: number;
}
export interface StorefrontCollection {
  id: string; fullName: string; shortName: string; descriptor: string; image: string;
  narrative: string; craftsmanship: string; packaging: string;
}

/** Visible collections, ordered, in the shape the storefront components use. */
export function toStorefrontCollections(list: AdminCollection[]): StorefrontCollection[] {
  return (Array.isArray(list) ? list : [])
    .filter((c) => c && c.isVisible !== false && (c.slug || c.id))
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((c) => ({
      id: c.slug || c.id,
      fullName: c.name,
      shortName: c.name,
      descriptor: c.shortDescription || '',
      image: c.bannerImageUrl || c.heroImageUrl || '/placeholder.svg',
      narrative: c.longDescription || '',
      craftsmanship: '',
      packaging: '',
    }));
}

/** Firestore rejects `undefined`; keep only plain, defined fields. */
export function cleanCollectionForFirestore(c: AdminCollection): AdminCollection {
  return {
    id: String(c.id),
    name: String(c.name ?? '').slice(0, 200),
    slug: String(c.slug ?? c.id).slice(0, 100),
    shortDescription: String(c.shortDescription ?? '').slice(0, 500),
    longDescription: String(c.longDescription ?? '').slice(0, 4000),
    bannerImageUrl: String(c.bannerImageUrl ?? '').slice(0, 2000),
    heroImageUrl: String(c.heroImageUrl ?? '').slice(0, 2000),
    isVisible: c.isVisible !== false,
    sortOrder: Number.isFinite(c.sortOrder) ? Number(c.sortOrder) : 0,
  };
}

export const MAX_PUBLISHED_JSON_BYTES = 900_000;

/** Serialises content for a Firestore string field; refuses documents that would exceed the 1 MB limit. */
export function serialiseForPublish(value: unknown): { ok: true; json: string } | { ok: false; error: string } {
  let json: string;
  try { json = JSON.stringify(value); } catch { return { ok: false, error: 'Content could not be saved (invalid data).' }; }
  if (!json || json === 'undefined') return { ok: false, error: 'Nothing to save.' };
  if (new TextEncoder().encode(json).length > MAX_PUBLISHED_JSON_BYTES) {
    return { ok: false, error: 'Content is too large to publish. Upload images instead of pasting them, then try again.' };
  }
  return { ok: true, json };
}

/** Parses a published JSON string; returns null for anything malformed. */
export function parsePublished<T = unknown>(json: unknown): T | null {
  if (typeof json !== 'string') return null;
  try { return JSON.parse(json) as T; } catch { return null; }
}

/** Only overrides saved for the CURRENT policy release are applied; stale ones are ignored (same rule as policyStore). */
export function usablePolicyOverrides(published: unknown, currentVersion: string): { version: string; overrides: Record<string, Record<string, unknown>> } | null {
  const p = published as any;
  if (!p || p.version !== currentVersion || typeof p.overrides !== 'object' || !p.overrides) return null;
  return p;
}
