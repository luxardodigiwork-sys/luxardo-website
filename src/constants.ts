import { Country, Language, Product } from './types';

export const COUNTRIES: Country[] = [
  { name: 'India', code: 'IN', currency: { code: 'INR', symbol: '₹', rate: 1 }, active: true },
  { name: 'United States', code: 'US', currency: { code: 'INR', symbol: '₹', rate: 1 }, active: true },
  { name: 'United Kingdom', code: 'GB', currency: { code: 'INR', symbol: '₹', rate: 1 }, active: true },
  { name: 'United Arab Emirates', code: 'AE', currency: { code: 'INR', symbol: '₹', rate: 1 }, active: true },
  { name: 'France', code: 'FR', currency: { code: 'INR', symbol: '₹', rate: 1 }, active: true },
  { name: 'Canada', code: 'CA', currency: { code: 'INR', symbol: '₹', rate: 1 }, active: false },
  { name: 'Australia', code: 'AU', currency: { code: 'INR', symbol: '₹', rate: 1 }, active: false },
  { name: 'Singapore', code: 'SG', currency: { code: 'INR', symbol: '₹', rate: 1 }, active: false },
];

export const LANGUAGES: Language[] = ['English (US)', 'French', 'Arabic'];

export const COLLECTIONS = [
  {
    id: 'kurta-editions',
    fullName: 'Premium Kurta Editions',
    shortName: 'Kurta Editions',
    descriptor: 'Timeless elegance redefined through meticulous craftsmanship and selected fabrics.',
    image: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?q=80&w=1000&auto=format&fit=crop',
    narrative: 'The Kurta Editions represent the soul of Luxardo. Each piece is a dialogue between heritage and modernity, designed for the man who values quiet confidence over loud statements.',
    craftsmanship: 'Hand-spun silk blends and precision-cut silhouettes define this collection. Every seam is finished by hand to ensure a drape that is as comfortable as it is commanding.',
    packaging: 'Each ensemble is delivered in a signature Luxardo archival box, wrapped in acid-free tissue and accompanied by a certificate of authenticity signed by the lead artisan.'
  },
  {
    id: 'formal-tailoring',
    fullName: 'Premium Formal Tailoring',
    shortName: 'Formal Tailoring',
    descriptor: 'Structured silhouettes and sharp lines for the discerning modern gentleman.',
    image: 'https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?q=80&w=1000&auto=format&fit=crop',
    narrative: 'Our Formal Tailoring collection is an exercise in discipline. We strip away the unnecessary to reveal the power of perfect proportions and superior construction.',
    craftsmanship: 'Utilizing traditional canvassing techniques and high-twist wool blends, these pieces offer a structural integrity that maintains its sharp silhouette throughout the longest evenings.',
    packaging: 'Presented in a structured garment carrier with custom-molded hangers, ensuring your tailoring arrives in pristine, ready-to-wear condition.'
  },
  {
    id: 'tailored-sets',
    fullName: 'Premium Tailored Sets',
    shortName: 'Tailored Sets',
    descriptor: 'Exquisite ensembles curated for the most significant moments of life.',
    image: 'https://images.unsplash.com/photo-1550005816-091e19677788?q=80&w=1000&auto=format&fit=crop',
    narrative: 'The Tailored Sets are curated for life’s milestones. These are not just garments; they are heirlooms in the making, designed to witness your most triumphant moments.',
    craftsmanship: 'Intricate zardosi work and hand-painted motifs are applied to heavy-weight silks. Each set requires over 200 hours of artisan labor to complete.',
    packaging: 'Housed in a velvet-lined wooden chest, these sets are protected for generations, reflecting the enduring value of the craftsmanship within.'
  },
  {
    id: 'koti-ensembles',
    fullName: 'Premium Koti Ensembles',
    shortName: 'Koti Ensembles',
    descriptor: 'A refined fusion of traditional silhouettes and contemporary tailoring.',
    image: 'https://images.unsplash.com/photo-1621335829175-95f437384d7c?q=80&w=1000&auto=format&fit=crop',
    narrative: 'Koti Ensembles bridge the gap between ceremony and celebration. They offer a versatile elegance that transitions seamlessly from formal rituals to social gatherings.',
    craftsmanship: 'Layered textures and contrasting fabric weights create a dynamic visual language. The Kotis feature hand-carved buttons and hidden utility pockets.',
    packaging: 'Wrapped in a custom-woven silk dust bag and placed within our signature minimalist carrier, emphasizing the blend of tradition and modern utility.'
  },
  {
    id: 'bomber-jackets',
    fullName: 'Premium Bomber Jackets',
    shortName: 'Bomber Jackets',
    descriptor: 'Elevated casual wear featuring precision finishing and premium materials.',
    image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=1000&auto=format&fit=crop',
    narrative: 'The Bomber Jackets redefine luxury leisure. They are designed for the man whose life is in constant motion but whose standards never waver.',
    craftsmanship: 'Technical silk-nylon blends and Italian leather accents are combined with a tailored fit. Ribbed details are custom-knit for each specific size.',
    packaging: 'Delivered in a compact, travel-ready case that doubles as a protective storage solution for your most versatile luxury layer.'
  }
];

export const PRODUCTS: Product[] = [
  {
    id: 'k1',
    name: 'Royal Ivory Kurta Set',
    price: 45000,
    category: 'Premium Kurta Editions',
    image: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?q=80&w=1000&auto=format&fit=crop',
    description: 'A masterpiece of modern ethnic tailoring, featuring selected fabrics and artisan craftsmanship.'
  },
  {
    id: 'b1',
    name: 'Midnight Velvet Bandhgala',
    price: 85000,
    category: 'Premium Formal Tailoring',
    image: 'https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?q=80&w=1000&auto=format&fit=crop',
    description: 'Refined presentation and structure, crafted for the private gentleman.'
  },
  {
    id: 's1',
    name: 'Artisan Gold Sherwani',
    price: 125000,
    category: 'Premium Tailored Sets',
    image: 'https://images.unsplash.com/photo-1598532163257-ae3c6b2524b6?q=80&w=1000&auto=format&fit=crop',
    description: 'Meticulous finishing and hand-painted detailing on selected imported fabrics.'
  },
  {
    id: 'i1',
    name: 'Modern Indo-Western Ensemble',
    price: 65000,
    category: 'Premium Koti Ensembles',
    image: 'https://images.unsplash.com/photo-1621335829175-95f437384d7c?q=80&w=1000&auto=format&fit=crop',
    description: 'A refined expression of craftsmanship for the modern gentleman.'
  },
  {
    id: 'j1',
    name: 'Precision Tailored Jacket',
    price: 35000,
    category: 'Premium Bomber Jackets',
    image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=1000&auto=format&fit=crop',
    description: 'Every piece is finished with attention to silhouette and structure.'
  },
  {
    id: 'w1',
    name: 'Imperial Wedding Sherwani',
    price: 185000,
    category: 'Premium Tailored Sets',
    image: 'https://images.unsplash.com/photo-1550005816-091e19677788?q=80&w=1000&auto=format&fit=crop',
    description: 'Reserved for our most discerning clients, featuring intricate artisan embroidery.'
  },
  {
    id: 'f1',
    name: 'Signature Festive Ensemble',
    price: 55000,
    category: 'Premium Koti Ensembles',
    image: 'https://images.unsplash.com/photo-1583391733958-d1501eq38234?q=80&w=1000&auto=format&fit=crop',
    description: 'A celebration of color and craftsmanship, designed for memorable occasions.'
  }
];
