/**
 * Policy text storage with versioning.
 *
 * Customers must always see the policy text shipped in the code (src/policies.ts). Previously the
 * defaults were copied into every visitor's localStorage on first view and then took precedence
 * forever, so updated policy text never reached returning visitors.
 *
 * Now:
 *  - Nothing is written to storage on read.
 *  - Only fields an admin has deliberately edited ("overrides") are stored, together with POLICY_VERSION.
 *  - Overrides saved under a different version (or the old un-versioned cache) are ignored, so a new
 *    policy release always reaches everyone. Old data is left in place, never deleted automatically.
 *
 * Note: overrides live in the editing browser only. They are an admin preview, not a published change;
 * publishing policy edits to customers needs a database-backed store (not part of this change).
 */
export const POLICY_OVERRIDES_KEY = 'LUXARDO FASHION_policy_overrides';
export const LEGACY_POLICIES_KEY = 'LUXARDO FASHION_policies'; // old un-versioned cache: never read

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

type PolicyMap = Record<string, Record<string, any>>;

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export function readPolicies<T extends PolicyMap>(defaults: T, store: StorageLike, version: string): T {
  const merged = clone(defaults);
  let raw: string | null = null;
  try { raw = store.getItem(POLICY_OVERRIDES_KEY); } catch { return merged; }
  if (!raw) return merged;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== version || typeof parsed.overrides !== 'object' || !parsed.overrides) return merged;
    for (const key of Object.keys(defaults)) {
      const o = parsed.overrides[key];
      if (o && typeof o === 'object') (merged as PolicyMap)[key] = { ...defaults[key], ...o };
    }
  } catch { /* corrupt data: fall back to defaults */ }
  return merged;
}

/** Stores only the fields that differ from the shipped defaults. */
export function writePolicies(policies: PolicyMap, defaults: PolicyMap, store: StorageLike, version: string): void {
  const overrides: PolicyMap = {};
  for (const key of Object.keys(defaults)) {
    const edited = policies?.[key];
    if (!edited) continue;
    for (const field of Object.keys(edited)) {
      if (JSON.stringify(edited[field]) !== JSON.stringify(defaults[key][field])) {
        (overrides[key] ||= {})[field] = edited[field];
      }
    }
  }
  if (Object.keys(overrides).length === 0) store.removeItem(POLICY_OVERRIDES_KEY);
  else store.setItem(POLICY_OVERRIDES_KEY, JSON.stringify({ version, overrides }));
}

export function resetPolicies(store: StorageLike): void {
  store.removeItem(POLICY_OVERRIDES_KEY);
  store.removeItem(LEGACY_POLICIES_KEY);
}
