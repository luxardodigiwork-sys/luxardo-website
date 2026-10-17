/** Stable collection IDs are used for new assignments; legacy names/slugs remain readable. */
export interface CollectionIdentity { id: string; categoryId?: string; fullName: string; shortName?: string }
const key = (value: unknown) => typeof value === 'string' ? value.normalize('NFKC').trim().toLowerCase().replace(/[\s_]+/g, '-') : '';
export function matchesCollection(category: unknown, collection: CollectionIdentity | undefined): boolean {
  const target = key(category);
  return !!target && !!collection && [collection.categoryId, collection.id, collection.fullName, collection.shortName].some(value => key(value) === target);
}
export function collectionLabel(category: string, collections: CollectionIdentity[]): string {
  return collections.find(collection => matchesCollection(category, collection))?.fullName ?? category;
}
export type CatalogueSort = 'featured' | 'newest' | 'price-low' | 'price-high';
export function sortCatalogue<T extends { featured?: boolean; createdAt?: string; price: number }>(products: T[], sort: CatalogueSort): T[] {
  const time = (value?: string) => { const n = Date.parse(value ?? ''); return Number.isFinite(n) ? n : 0; };
  return [...products].sort((a, b) => sort === 'newest' ? time(b.createdAt) - time(a.createdAt)
    : sort === 'price-low' ? a.price - b.price : sort === 'price-high' ? b.price - a.price : Number(!!b.featured) - Number(!!a.featured));
}

export function collectionOptions(collections: Array<{ id: string; name: string }>) {
  return collections.map(collection => ({ value: collection.id, label: collection.name }));
}
