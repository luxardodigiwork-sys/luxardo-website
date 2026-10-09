import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../constants';

/**
 * Collections (categories) — ONE list for the whole site.
 *
 * Source of truth is the Firestore `categories` collection, edited in
 * Admin → Collections. The header menu, collection pages, home page,
 * search and the admin product form all read from here, so a collection
 * added or renamed in admin shows up everywhere with the same link.
 *
 * Products are matched to a collection by name, slug or id, ignoring case
 * and spaces ("CASUAL" = "Casual" = "casual").
 */
export type Category = {
  id: string;
  name: string;
  slug: string;
  shortDescription?: string;
  longDescription?: string;
  heroImageUrl?: string;
  bannerImageUrl?: string;
  sortOrder: number;
  isVisible: boolean;
};

const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function slugify(s: string): string {
  return String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Used only if the database has no collections yet (fresh project). */
const FALLBACK: Category[] = COLLECTIONS.map((c: any, i: number) => ({
  id: c.id,
  name: c.fullName,
  slug: c.id,
  shortDescription: c.descriptor,
  heroImageUrl: c.image,
  bannerImageUrl: c.image,
  sortOrder: i,
  isVisible: true,
}));

export function productInCategory(product: { category?: string } | null | undefined, cat: Category): boolean {
  const pc = norm(product?.category);
  if (!pc) return false;
  return pc === norm(cat.name) || pc === norm(cat.slug) || pc === norm(cat.id);
}

type Ctx = {
  /** Visible collections, in admin sort order. */
  categories: Category[];
  /** Every collection including hidden ones (for admin). */
  allCategories: Category[];
  isLoading: boolean;
  findCategory: (slugOrIdOrName: string | undefined | null) => Category | undefined;
  categoryForProduct: (product: { category?: string } | null | undefined) => Category | undefined;
};

const CategoriesContext = createContext<Ctx | undefined>(undefined);

export function CategoriesProvider({ children }: { children: React.ReactNode }) {
  const [all, setAll] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'categories'),
      (snap) => {
        const list = snap.docs.map((d) => {
          const x: any = d.data();
          const name = String(x.name || d.id).trim();
          return {
            id: d.id,
            name,
            slug: String(x.slug || '').trim() || slugify(name),
            shortDescription: x.shortDescription,
            longDescription: x.longDescription,
            heroImageUrl: x.heroImageUrl,
            bannerImageUrl: x.bannerImageUrl,
            sortOrder: Number(x.sortOrder) || 0,
            isVisible: x.isVisible !== false,
          } as Category;
        });
        list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
        setAll(list);
        setIsLoading(false);
      },
      (err) => {
        console.warn('[Categories] load failed, using built-in list', err);
        setIsLoading(false);
      },
    );
    return () => unsub();
  }, []);

  const allCategories = all.length ? all : isLoading ? [] : FALLBACK;
  const categories = allCategories.filter((c) => c.isVisible);

  const findCategory = (key: string | undefined | null) => {
    const k = norm(key);
    if (!k) return undefined;
    return (
      allCategories.find((c) => norm(c.slug) === k) ||
      allCategories.find((c) => norm(c.id) === k || norm(c.name) === k) ||
      // Old links from before collections moved to the database
      // (e.g. /collections/tuxedo, /collections/three-piece-suit).
      (() => {
        const legacy: any = COLLECTIONS.find((c: any) => norm(c.id) === k);
        return legacy ? allCategories.find((c) => norm(c.name) === norm(legacy.fullName)) : undefined;
      })()
    );
  };

  const categoryForProduct = (product: { category?: string } | null | undefined) =>
    allCategories.find((c) => productInCategory(product, c));

  return (
    <CategoriesContext.Provider value={{ categories, allCategories, isLoading, findCategory, categoryForProduct }}>
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories() {
  const ctx = useContext(CategoriesContext);
  if (!ctx) throw new Error('useCategories must be used within CategoriesProvider');
  return ctx;
}
