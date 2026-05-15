import { Country, Language, Product } from './types';

export const COUNTRIES: Country[] = [
  {
    name: 'India',
    code: 'IN',
    currency: { code: 'INR', symbol: '₹', rate: 1 },
    active: true,
    language: 'English (US)'
  },
  {
    name: 'United States',
    code: 'US',
    currency: { code: 'USD', symbol: '$', rate: 0.012 },
    active: true,
    language: 'English (US)'
  },
  {
    name: 'United Kingdom',
    code: 'GB',
    currency: { code: 'GBP', symbol: '£', rate: 0.0095 },
    active: true,
    language: 'English (US)'
  },
  {
    name: 'United Arab Emirates',
    code: 'AE',
    currency: { code: 'AED', symbol: 'د.إ', rate: 0.044 },
    active: true,
    language: 'Arabic'
  },
  {
    name: 'France',
    code: 'FR',
    currency: { code: 'EUR', symbol: '€', rate: 0.011 },
    active: true,
    language: 'French'
  },

  // Coming Soon Countries
  {
    name: 'Canada',
    code: 'CA',
    currency: { code: 'CAD', symbol: 'C$', rate: 0.016 },
    active: false,
    language: 'English (US)'
  },
  {
    name: 'Australia',
    code: 'AU',
    currency: { code: 'AUD', symbol: 'A$', rate: 0.018 },
    active: false,
    language: 'English (US)'
  },
  {
    name: 'Singapore',
    code: 'SG',
    currency: { code: 'SGD', symbol: 'S$', rate: 0.016 },
    active: false,
    language: 'English (US)'
  }
];

export const LANGUAGES: Language[] = [
  'English (US)',
  'French',
  'Arabic'
];

export const COLLECTIONS = [
  {
    id: 'three-piece-suit',
    fullName: '3 Piece Suit',
    shortName: '3 Piece Suit',
    descriptor: 'Complete tailored ensembles for the discerning gentleman.',
    image: '',
    narrative: 'The ultimate expression of tailored perfection.',
    craftsmanship: 'Three-layer construction for a flawless fit.',
    packaging: 'Archival box with premium garment protection.'
  },

  {
    id: 'tuxedo',
    fullName: 'Tuxedo',
    shortName: 'Tuxedo',
    descriptor: 'The pinnacle of formal evening wear.',
    image: '',
    narrative: 'Crafted for prestigious evenings and ceremonial occasions.',
    craftsmanship: 'Traditional canvassing and hand-finished satin detailing.',
    packaging: 'Structured garment carrier with signature presentation.'
  },

  {
    id: 'jodhpuri',
    fullName: 'Jodhpuri',
    shortName: 'Jodhpuri',
    descriptor: 'Royal silhouettes inspired by Indian heritage tailoring.',
    image: '',
    narrative: 'A commanding expression of culture and modern luxury.',
    craftsmanship: 'Structured shoulders with artisanal finishing.',
    packaging: 'Luxury archival preservation box.'
  },

  {
    id: 'koti-pant',
    fullName: 'Koti Pant',
    shortName: 'Koti Pant',
    descriptor: 'Modern Indo-western tailoring for contemporary occasions.',
    image: '',
    narrative: 'Minimal elegance blended with heritage aesthetics.',
    craftsmanship: 'Sharp silhouettes with premium construction.',
    packaging: 'Premium signature packaging experience.'
  },

  {
    id: 'koti-kurta',
    fullName: 'Koti Kurta',
    shortName: 'Koti Kurta',
    descriptor: 'Traditional layering redefined with modern precision.',
    image: '',
    narrative: 'Crafted for timeless festive sophistication.',
    craftsmanship: 'Hand-finished detailing with elevated tailoring.',
    packaging: 'Wrapped in signature luxury dust protection.'
  },

  {
    id: 'kurta',
    fullName: 'Kurta',
    shortName: 'Kurta',
    descriptor: 'Classic Indian silhouettes crafted with refined fabrics.',
    image: '',
    narrative: 'The soul of timeless elegance.',
    craftsmanship: 'Precision-cut panels and clean finishing.',
    packaging: 'Luxury folded presentation packaging.'
  },

  {
    id: 'casual',
    fullName: 'Casual',
    shortName: 'Casual',
    descriptor: 'Modern luxury essentials for everyday sophistication.',
    image: '',
    narrative: 'Contemporary tailoring for effortless confidence.',
    craftsmanship: 'Premium fabric blends with clean construction.',
    packaging: 'Minimal luxury delivery presentation.'
  }
];

/*
|--------------------------------------------------------------------------
| PRODUCTS
|--------------------------------------------------------------------------
| Products now come directly from Firebase Firestore.
| No demo/mock/sample products are generated locally anymore.
|--------------------------------------------------------------------------
*/

export const PRODUCTS: Product[] = [];