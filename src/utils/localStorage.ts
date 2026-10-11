import { Product, Order, User, MediaItem, BackendUser, BackendSettings } from '../types';
import { productStore } from './productStore';
import { orderStore } from './orderStore';
import { readPolicies, writePolicies, resetPolicies } from './policyStore';
import { DEFAULT_SITE_CONTENT } from '../constants/homeContent';
import { DEFAULT_PRIME_CONTENT } from '../constants/primeContent';
import { 
  POLICY_VERSION,
  SHIPPING_POLICY, 
  RETURNS_POLICY, 
  PRIVACY_POLICY, 
  TERMS_POLICY, 
  MEMBERSHIP_TERMS 
} from '../policies';

// Keys for localStorage
const KEYS = {
  PRODUCTS: 'LUXARDO FASHION_products',
  ORDERS: 'LUXARDO FASHION_orders',
  USERS: 'LUXARDO FASHION_users',
  SITE_CONTENT: 'LUXARDO FASHION_site_content',
  PRIME_CONTENT: 'LUXARDO FASHION_prime_content',
  POLICIES: 'LUXARDO FASHION_policies',
  DASHBOARD_STATS: 'LUXARDO FASHION_dashboard_stats',
  DUMMY_ADMIN: 'LUXARDO FASHION_dummy_admin',
  MEDIA: 'LUXARDO FASHION_media',
  BACKEND_USERS: 'LUXARDO FASHION_backend_users',
  BACKEND_SETTINGS: 'LUXARDO FASHION_backend_settings',
  PRIME_GLOBAL_SETTINGS: 'LUXARDO FASHION_prime_global_settings'
};

// No mock customers are seeded. Real customers live in Firestore (`customers`); this browser-local list
// only holds Prime-membership admin edits and starts empty.
// Earlier builds seeded three fake customers into browser storage; they are filtered out on read.
const LEGACY_SEEDED_USERS: { id: string; email: string }[] = [
  { id: 'user1', email: 'rahul@example.com' },
  { id: 'user2', email: 'priya@example.com' },
  { id: 'user3', email: 'amit@example.com' },
];
const isLegacySeededUser = (u: { id?: string; email?: string }) =>
  LEGACY_SEEDED_USERS.some((l) => l.id === u.id && l.email === u.email);


// Initial Policies
const INITIAL_POLICIES = {
  shipping: {
    title: 'Shipping Policy',
    content: SHIPPING_POLICY,
    secondaryNote: 'Standard delivery times may vary based on location and order complexity.'
  },
  returns: {
    title: 'Returns Policy',
    content: RETURNS_POLICY,
    secondaryNote: 'Bespoke and customized items are generally non-returnable.'
  },
  privacy: {
    title: 'Privacy Policy',
    content: PRIVACY_POLICY,
    secondaryNote: 'Your data security is our priority. We never sell your information.'
  },
  terms: {
    title: 'Terms & Conditions',
    content: TERMS_POLICY,
    secondaryNote: 'By using our services, you agree to these terms.'
  },
  'membership-terms': {
    title: 'Membership Terms',
    content: MEMBERSHIP_TERMS,
    secondaryNote: 'Membership benefits are subject to active subscription status.'
  }
};

const DEFAULT_BACKEND_SETTINGS: BackendSettings = {
  defaultStatuses: ['verified', 'packed', 'shipped', 'delivered'],
  verificationWorkflow: 'simple',
  courierFieldsVisible: true,
  trackingIdRequired: true,
  dispatchNotesEnabled: true,
  courierIntegration: {
    enabled: false,
    provider: 'DTDC',
    apiKey: '',
    clientId: '',
    environment: 'sandbox',
    originPincode: ''
  }
};

// No mock staff accounts are seeded. Real staff are managed on the (Firestore-authenticated) admin side;
// this list only feeds the dispatch "assign staff" picker and starts empty.
const LEGACY_SEEDED_STAFF_IDS = ['dispatch-1']; // earlier builds seeded a fake dispatch user into browser storage

export const storage = {
  // Products
  // Products live in Firestore (see productStore.ts). This synchronous accessor
  // returns the live-synced cache so legacy callers keep working; React code should
  // prefer useProducts() so it re-renders on catalogue changes.
  getProducts: (): Product[] => productStore.getAll(),

  // Orders live in Firestore (see orderStore.ts); there is no local order database any more.
  // This read-only accessor returns the live admin cache (empty for non-admins).
  getOrders: (): Order[] => orderStore.getAll(),

  // Users
  getUsers: (): User[] => {
    const data = localStorage.getItem(KEYS.USERS);
    if (!data) return [];
    try {
      return (JSON.parse(data) as User[]).filter((u) => !isLegacySeededUser(u));
    } catch {
      return [];
    }
  },
  saveUsers: (users: User[]) => {
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
  },
  updateUser: (updatedUser: User) => {
    const users = storage.getUsers();
    const index = users.findIndex(u => u.id === updatedUser.id);
    if (index !== -1) {
      users[index] = updatedUser;
      storage.saveUsers(users);
    }
  },

  // Content
  getSiteContent: () => {
    const data = localStorage.getItem(KEYS.SITE_CONTENT);
    if (data) {
      const parsedData = JSON.parse(data);
      
      // Force update collections if they are still using the old 4 items or old heading
      let collectionsData = parsedData.homepage?.collections;
      if (collectionsData && (collectionsData.items?.length === 4 || collectionsData.heading === 'Signature Collections')) {
        collectionsData = DEFAULT_SITE_CONTENT.homepage.collections;
      }

      // Force update craftsmanship if it's using the old schema
      let craftsmanshipData = parsedData.craftsmanship;
      if (craftsmanshipData && !craftsmanshipData.visualDepth) {
        craftsmanshipData = DEFAULT_SITE_CONTENT.craftsmanship;
      }

      // Deep merge with DEFAULT_SITE_CONTENT to ensure all properties exist
      return {
        ...DEFAULT_SITE_CONTENT,
        ...parsedData,
        homepage: { 
          ...DEFAULT_SITE_CONTENT.homepage, 
          ...(parsedData.homepage || {}),
          collections: collectionsData || DEFAULT_SITE_CONTENT.homepage.collections,
          hero: {
            ...DEFAULT_SITE_CONTENT.homepage.hero,
            ...(parsedData.homepage?.hero || {}),
            primaryCtaLink: parsedData.homepage?.hero?.primaryCtaLink === '/collections/new-arrivals' ? '/collections' : (parsedData.homepage?.hero?.primaryCtaLink || DEFAULT_SITE_CONTENT.homepage.hero.primaryCtaLink)
          }
        },
        ourStory: { ...DEFAULT_SITE_CONTENT.ourStory, ...(parsedData.ourStory || {}) },
        craftsmanship: craftsmanshipData || DEFAULT_SITE_CONTENT.craftsmanship,
        wholesale: { ...DEFAULT_SITE_CONTENT.wholesale, ...(parsedData.wholesale || {}) },
        contact: { 
          ...DEFAULT_SITE_CONTENT.contact, 
          ...(parsedData.contact || {}),
          details: { ...DEFAULT_SITE_CONTENT.contact.details, ...(parsedData.contact?.details || {}) },
          hours: { ...DEFAULT_SITE_CONTENT.contact.hours, ...(parsedData.contact?.hours || {}) },
          socials: { ...DEFAULT_SITE_CONTENT.contact.socials, ...(parsedData.contact?.socials || {}) }
        },
        footer: { ...DEFAULT_SITE_CONTENT.footer, ...(parsedData.footer || {}) }
      };
    }
    
    // Migration from old HOME_CONTENT if exists
    const oldHomeData = localStorage.getItem('LUXARDO FASHION_home_content');
    if (oldHomeData) {
      const homeContent = JSON.parse(oldHomeData);
      const newContent = { ...DEFAULT_SITE_CONTENT, homepage: { ...DEFAULT_SITE_CONTENT.homepage, ...homeContent } };
      localStorage.setItem(KEYS.SITE_CONTENT, JSON.stringify(newContent));
      localStorage.removeItem('LUXARDO FASHION_home_content');
      return newContent;
    }

    return DEFAULT_SITE_CONTENT;
  },
  saveSiteContent: (content: any) => {
    localStorage.setItem(KEYS.SITE_CONTENT, JSON.stringify(content));
  },
  resetSiteContent: () => {
    localStorage.removeItem(KEYS.SITE_CONTENT);
  },

  getPrimeContent: () => {
    const data = localStorage.getItem(KEYS.PRIME_CONTENT);
    return data ? JSON.parse(data) : DEFAULT_PRIME_CONTENT;
  },
  savePrimeContent: (content: any) => {
    localStorage.setItem(KEYS.PRIME_CONTENT, JSON.stringify(content));
  },
  resetPrimeContent: () => {
    localStorage.removeItem(KEYS.PRIME_CONTENT);
  },

  // Prime Global Settings
  getPrimeGlobalSettings: () => {
    const data = localStorage.getItem(KEYS.PRIME_GLOBAL_SETTINGS);
    if (!data) {
      const defaultSettings = {
        isLive: true,
        offlineMessage: 'Prime Member access is currently unavailable. Please check back soon.'
      };
      localStorage.setItem(KEYS.PRIME_GLOBAL_SETTINGS, JSON.stringify(defaultSettings));
      return defaultSettings;
    }
    return JSON.parse(data);
  },
  savePrimeGlobalSettings: (settings: any) => {
    localStorage.setItem(KEYS.PRIME_GLOBAL_SETTINGS, JSON.stringify(settings));
  },

  // Policies
  // Customers always get the shipped defaults; only deliberate admin edits (same POLICY_VERSION) are layered on top.
  getPolicies: () => readPolicies(INITIAL_POLICIES, localStorage, POLICY_VERSION),
  savePolicies: (policies: any) => writePolicies(policies, INITIAL_POLICIES, localStorage, POLICY_VERSION),
  resetPolicies: () => resetPolicies(localStorage),


  // Bespoke Requests
  getBespokeRequests: (): any[] => {
    const data = localStorage.getItem('LUXARDO FASHION_bespoke_requests');
    return data ? JSON.parse(data) : [];
  },
  saveBespokeRequests: (requests: any[]) => {
    localStorage.setItem('LUXARDO FASHION_bespoke_requests', JSON.stringify(requests));
  },
  addBespokeRequest: (request: any) => {
    const requests = storage.getBespokeRequests();
    requests.unshift(request);
    storage.saveBespokeRequests(requests);
  },

  // Wholesale Inquiries
  getWholesaleInquiries: (): any[] => {
    const data = localStorage.getItem('LUXARDO FASHION_wholesale_inquiries');
    return data ? JSON.parse(data) : [];
  },
  saveWholesaleInquiries: (inquiries: any[]) => {
    localStorage.setItem('LUXARDO FASHION_wholesale_inquiries', JSON.stringify(inquiries));
  },
  addWholesaleInquiry: (inquiry: any) => {
    const inquiries = storage.getWholesaleInquiries();
    inquiries.unshift(inquiry);
    storage.saveWholesaleInquiries(inquiries);
  },

  // Contact Messages
  getContactMessages: (): any[] => {
    const data = localStorage.getItem('LUXARDO FASHION_contact_messages');
    return data ? JSON.parse(data) : [];
  },
  saveContactMessages: (messages: any[]) => {
    localStorage.setItem('LUXARDO FASHION_contact_messages', JSON.stringify(messages));
  },
  addContactMessage: (message: any) => {
    const messages = storage.getContactMessages();
    messages.unshift(message);
    storage.saveContactMessages(messages);
  },

  // Dashboard Stats
  getDashboardStats: () => {
    const orders = storage.getOrders();
    const products = storage.getProducts();
    const users = storage.getUsers();
    
    const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const totalOrders = orders.length;
    const totalProducts = products.length;
    const activeMembers = users.filter(u => u.isPrimeMember && u.membershipExpiry && new Date(u.membershipExpiry) > new Date()).length;

    return {
      totalRevenue,
      totalOrders,
      totalProducts,
      activeMembers,
      recentOrders: orders.slice(0, 5)
    };
  },

  // Auth
  isAdminLoggedIn: () => {
    return localStorage.getItem(KEYS.DUMMY_ADMIN) === 'true';
  },
  loginAdmin: () => {
    localStorage.setItem(KEYS.DUMMY_ADMIN, 'true');
  },
  logoutAdmin: () => {
    localStorage.removeItem(KEYS.DUMMY_ADMIN);
  },

  // Saved Address
  getSavedAddress: (userId: string) => {
    const data = localStorage.getItem(`LUXARDO FASHION_saved_address_${userId}`);
    return data ? JSON.parse(data) : null;
  },
  saveAddress: (userId: string, address: any) => {
    localStorage.setItem(`LUXARDO FASHION_saved_address_${userId}`, JSON.stringify(address));
  },

  // Media
  getMedia: (): MediaItem[] => {
    const data = localStorage.getItem(KEYS.MEDIA);
    if (!data) {
      // Seed initial media from products and site content
      const products = storage.getProducts();
      const siteContent = storage.getSiteContent();
      
      const initialMedia: MediaItem[] = [];
      
      // From products
      products.forEach(p => {
        initialMedia.push({
          id: `media-prod-${p.id}`,
          url: p.image,
          name: p.name,
          type: 'product',
          uploadDate: p.createdAt || new Date().toISOString(),
          dimensions: '1920x1080'
        });
        if (p.images) {
          p.images.forEach((img, idx) => {
            initialMedia.push({
              id: `media-prod-${p.id}-extra-${idx}`,
              url: img,
              name: `${p.name} - View ${idx + 1}`,
              type: 'product',
              uploadDate: p.createdAt || new Date().toISOString(),
              dimensions: '1920x1080'
            });
          });
        }
      });
      
      // From homepage
      if (siteContent.homepage?.hero?.image) {
        initialMedia.push({
          id: 'media-home-hero',
          url: siteContent.homepage.hero.image,
          name: 'Homepage Hero',
          type: 'homepage',
          uploadDate: new Date().toISOString(),
          dimensions: '2560x1440'
        });
      }
      
      localStorage.setItem(KEYS.MEDIA, JSON.stringify(initialMedia));
      return initialMedia;
    }
    return JSON.parse(data);
  },
  saveMedia: (media: MediaItem[]) => {
    localStorage.setItem(KEYS.MEDIA, JSON.stringify(media));
  },
  addMedia: (item: MediaItem) => {
    const media = storage.getMedia();
    media.unshift(item);
    storage.saveMedia(media);
  },
  updateMedia: (updatedItem: MediaItem) => {
    const media = storage.getMedia();
    const index = media.findIndex(m => m.id === updatedItem.id);
    if (index !== -1) {
      media[index] = updatedItem;
      storage.saveMedia(media);
    }
  },
  deleteMedia: (id: string) => {
    const media = storage.getMedia();
    const filtered = media.filter(m => m.id !== id);
    storage.saveMedia(filtered);
  },
  replaceMediaUrl: (oldUrl: string, newUrl: string) => {
    // 1. Update Products
    const products = storage.getProducts();
    let productsChanged = false;
    const updatedProducts = products.map(p => {
      let changed = false;
      let mainImage = p.image;
      if (mainImage === oldUrl) {
        mainImage = newUrl;
        changed = true;
      }
      
      const extraImages = p.images?.map(img => {
        if (img === oldUrl) {
          changed = true;
          return newUrl;
        }
        return img;
      });

      if (changed) {
        productsChanged = true;
        return { ...p, image: mainImage, images: extraImages };
      }
      return p;
    });
    if (productsChanged) {
      const changed = updatedProducts.filter((p, i) => p !== products[i]);
      productStore.saveMany(changed).catch((err) => console.error('Failed to update product images:', err));
    }

    // 2. Update Site Content
    const siteContent = storage.getSiteContent();
    const contentStr = JSON.stringify(siteContent);
    if (contentStr.includes(oldUrl)) {
      const updatedContentStr = contentStr.split(oldUrl).join(newUrl);
      storage.saveSiteContent(JSON.parse(updatedContentStr));
    }

    // 3. Update Media Library itself (other items might have same URL if duplicated)
    const media = storage.getMedia();
    const updatedMedia = media.map(m => {
      if (m.url === oldUrl) {
        return { ...m, url: newUrl };
      }
      return m;
    });
    storage.saveMedia(updatedMedia);
  },
  isMediaInUse: (url: string): { inUse: boolean; locations: string[] } => {
    const locations: string[] = [];
    
    // Check Products
    const products = storage.getProducts();
    products.forEach(p => {
      if (p.image === url || p.images?.includes(url)) {
        locations.push(`Product: ${p.name}`);
      }
    });

    // Check Site Content
    const siteContent = storage.getSiteContent();
    const contentStr = JSON.stringify(siteContent);
    if (contentStr.includes(url)) {
      locations.push('Site Content (Homepage/Pages)');
    }

    return {
      inUse: locations.length > 0,
      locations
    };
  },

  // Backend Management
  getBackendUsers: (): BackendUser[] => {
    const data = localStorage.getItem(KEYS.BACKEND_USERS);
    if (!data) return [];
    try {
      // Drop the legacy fake account and never expose any stored password field.
      return (JSON.parse(data) as BackendUser[])
        .filter((u) => !LEGACY_SEEDED_STAFF_IDS.includes(u.id))
        .map(({ password, ...rest }: any) => rest as BackendUser);
    } catch {
      return [];
    }
  },
  saveBackendUsers: (users: BackendUser[]) => {
    localStorage.setItem(KEYS.BACKEND_USERS, JSON.stringify(users));
  },
  getBackendSettings: (): BackendSettings => {
    const data = localStorage.getItem(KEYS.BACKEND_SETTINGS);
    if (!data) {
      localStorage.setItem(KEYS.BACKEND_SETTINGS, JSON.stringify(DEFAULT_BACKEND_SETTINGS));
      return DEFAULT_BACKEND_SETTINGS;
    }
    return JSON.parse(data);
  },
  saveBackendSettings: (settings: BackendSettings) => {
    localStorage.setItem(KEYS.BACKEND_SETTINGS, JSON.stringify(settings));
  }
};
