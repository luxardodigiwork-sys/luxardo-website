import { Country, Language } from './types';

// INR only: prices are shown and charged in INR, never converted.
const INR = { code: 'INR', symbol: '₹', rate: 1 };

export const COUNTRIES: Country[] = [
  { name: 'India', code: 'IN', currency: INR, active: true, language: 'English (US)' },
  { name: 'United States', code: 'US', currency: INR, active: true, language: 'English (US)' },
  { name: 'United Kingdom', code: 'GB', currency: INR, active: true, language: 'English (US)' },
  { name: 'United Arab Emirates', code: 'AE', currency: INR, active: true, language: 'Arabic' },
  { name: 'France', code: 'FR', currency: INR, active: true, language: 'French' },
  { name: 'Canada', code: 'CA', currency: INR, active: false, language: 'English (US)' },
  { name: 'Australia', code: 'AU', currency: INR, active: false, language: 'English (US)' },
  { name: 'Singapore', code: 'SG', currency: INR, active: false, language: 'English (US)' },
];

export const LANGUAGES: Language[] = ['English (US)', 'French', 'Arabic'];

export const COLLECTIONS = [
  {
    id: 'three-piece-suit',
    fullName: '3 Piece Suit',
    shortName: '3 Piece Suit',
    descriptor: 'Complete tailored ensembles for the discerning gentleman.',
    image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=1000&auto=format&fit=crop',
    narrative: 'The ultimate expression of tailored perfection.',
    craftsmanship: 'Three-layer construction for a flawless fit.',
    packaging: 'Archival box with premium garment protection.'
  },
  {
    id: 'tuxedo',
    fullName: 'Tuxedo',
    shortName: 'Tuxedo',
    descriptor: 'The pinnacle of formal evening wear.',
    image: 'https://images.unsplash.com/photo-1593030761757-71fae46af504?q=80&w=1000&auto=format&fit=crop',
    narrative: 'Crafted for the most prestigious occasions.',
    craftsmanship: 'Traditional canvassing and satin lapels.',
    packaging: 'Structured garment carrier with custom hangers.'
  },
  {
    id: 'jodhpuri',
    fullName: 'Jodhpuri',
    shortName: 'Jodhpuri',
    descriptor: 'Regal Jodhpuri jackets for a commanding presence.',
    image: 'https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?q=80&w=1000&auto=format&fit=crop',
    narrative: 'A symbol of heritage and authority.',
    craftsmanship: 'Structured shoulders and hand-carved buttons.',
    packaging: 'Signature archival box with certificate.'
  },
  {
    id: 'koti-pant',
    fullName: 'Koti Pant',
    shortName: 'Koti Pant',
    descriptor: 'Indo-western fusion featuring tailored kotis and trousers.',
    image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=1000&auto=format&fit=crop',
    narrative: 'The Koti Pant set is for the modern trendsetter.',
    craftsmanship: 'Sharp silhouettes and premium wool-silk blends.',
    packaging: 'Signature archival box presentation.'
  },
  {
    id: 'koti-kurta',
    fullName: 'Koti Kurta',
    shortName: 'Koti Kurta',
    descriptor: 'Traditional silhouettes with a modern koti layer.',
    image: 'https://images.unsplash.com/photo-1621335829175-95f437384d7c?q=80&w=1000&auto=format&fit=crop',
    narrative: 'A refined fusion of tradition and tailoring.',
    craftsmanship: 'Hand-finished kotis with intricate detailing.',
    packaging: 'Wrapped in custom silk dust bags.'
  },
  {
    id: 'kurta',
    fullName: 'Kurta',
    shortName: 'Kurta',
    descriptor: 'Timeless kurtas crafted from the finest silks and linens.',
    image: 'https://images.unsplash.com/photo-1584916201218-f4242ceb4809?q=80&w=1000&auto=format&fit=crop',
    narrative: 'The soul of LUXARDO FASHION lies in our classic kurtas.',
    craftsmanship: 'Precision cut and hand-finished seams.',
    packaging: 'Acid-free tissue wrapping in archival boxes.'
  },
  {
    id: 'casual',
    fullName: 'Casual',
    shortName: 'Casual',
    descriptor: 'Modern tailored shirts and trousers for daily luxury.',
    image: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?q=80&w=1000&auto=format&fit=crop',
    narrative: 'Our Casual collection defines contemporary workwear.',
    craftsmanship: 'Precision stitching and premium cotton blends.',
    packaging: 'Delivered in a signature LUXARDO FASHION box.'
  }
];

/**
 * Product `category` values the storefront understands. Collection pages match
 * `product.category === collection.fullName` exactly, so admin forms must offer exactly these names.
 */
export const COLLECTION_CATEGORIES: string[] = COLLECTIONS.map((c) => c.fullName);
