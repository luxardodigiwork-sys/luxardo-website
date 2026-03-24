import { Product, Order, User, MediaItem, DispatchUser, DispatchSettings } from '../types';
import { PRODUCTS } from '../constants';
import { DEFAULT_SITE_CONTENT } from '../constants/homeContent';
import { DEFAULT_PRIME_CONTENT } from '../constants/primeContent';
import { 
  SHIPPING_POLICY, 
  RETURNS_POLICY, 
  PRIVACY_POLICY, 
  TERMS_POLICY, 
  MEMBERSHIP_TERMS 
} from '../policies';

// Keys for localStorage
const KEYS = {
  PRODUCTS: 'luxardo_products',
  ORDERS: 'luxardo_orders',
  USERS: 'luxardo_users',
  SITE_CONTENT: 'luxardo_site_content',
  PRIME_CONTENT: 'luxardo_prime_content',
  POLICIES: 'luxardo_policies',
  DASHBOARD_STATS: 'luxardo_dashboard_stats',
  DUMMY_ADMIN: 'luxardo_dummy_admin',
  MEDIA: 'luxardo_media',
  DISPATCH_USERS: 'luxardo_dispatch_users',
  DISPATCH_SETTINGS: 'luxardo_dispatch_settings',
  PRIME_GLOBAL_SETTINGS: 'luxardo_prime_global_settings'
};

// Initial mock users
const INITIAL_USERS: User[] = [
  {
    id: 'user1',
    name: 'Rahul Sharma',
    email: 'rahul@example.com',
    role: 'user',
    isPrimeMember: true,
    membershipActivation: new Date(Date.now() - 86400000 * 30).toISOString(),
    membershipExpiry: new Date(Date.now() + 86400000 * 335).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 60).toISOString(),
    primePrivileges: {
      consultation: true,
      bespoke: true,
      fabricLibrary: true,
      prioritySupport: true
    }
  },
  {
    id: 'user2',
    name: 'Priya Patel',
    email: 'priya@example.com',
    role: 'user',
    isPrimeMember: false,
    createdAt: new Date(Date.now() - 86400000 * 15).toISOString()
  },
  {
    id: 'user3',
    name: 'Amit Verma',
    email: 'amit@example.com',
    role: 'user',
    isPrimeMember: true,
    membershipActivation: new Date(Date.now() - 86400000 * 366).toISOString(),
    membershipExpiry: new Date(Date.now() - 86400000).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 400).toISOString(),
    primePrivileges: {
      consultation: true,
      bespoke: false,
      fabricLibrary: true,
      prioritySupport: false
    }
  }
];

// Initial mock orders
const INITIAL_ORDERS: Order[] = [
  {
    id: 'ORD-001',
    userId: 'user1',
    userName: 'Rahul Sharma',
    userEmail: 'rahul@example.com',
    items: [
      { 
        productId: 'k1', 
        name: 'Royal Ivory Kurta Set', 
        quantity: 1, 
        price: 45000,
        image: 'https://picsum.photos/seed/kurta1/800/1200',
        category: 'Kurta Editions'
      }
    ],
    totalAmount: 45000,
    status: 'delivered',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    shippingAddress: {
      fullName: 'Rahul Sharma',
      email: 'rahul@example.com',
      phone: '+91 98765 43210',
      addressLine1: '123, MG Road',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400001',
      country: 'India'
    }
  },
  {
    id: 'ORD-002',
    userId: 'user2',
    userName: 'Priya Patel',
    userEmail: 'priya@example.com',
    items: [
      { 
        productId: 'b1', 
        name: 'Midnight Velvet Bandhgala', 
        quantity: 1, 
        price: 85000,
        image: 'https://picsum.photos/seed/bandhgala1/800/1200',
        category: 'Formal Tailoring'
      }
    ],
    totalAmount: 85000,
    status: 'processing',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    shippingAddress: {
      fullName: 'Priya Patel',
      email: 'priya@example.com',
      phone: '+91 98765 43210',
      addressLine1: '456, Jubilee Hills',
      city: 'Hyderabad',
      state: 'Telangana',
      postalCode: '500033',
      country: 'India'
    }
  }
];

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

const DEFAULT_DISPATCH_SETTINGS: DispatchSettings = {
  defaultStatuses: ['verified', 'packed', 'shipped', 'delivered'],
  verificationWorkflow: 'simple',
  courierFieldsVisible: true,
  trackingIdRequired: true,
  dispatchNotesEnabled: true
};

const INITIAL_DISPATCH_USERS: DispatchUser[] = [
  {
    id: 'dispatch-1',
    fullName: 'Arjun Singh',
    username: 'arjun_dispatch',
    password: 'dispatch123',
    role: 'Senior Dispatcher',
    status: 'active',
    createdAt: new Date().toISOString(),
    permissions: {
      canVerifyOrders: true,
      canMarkPacked: true,
      canMarkShipped: true,
      canMarkDelivered: true,
      canEditTrackingId: true,
      canViewCustomerAddress: true,
      canExportOrders: true
    }
  }
];

export const storage = {
  // Products
  getProducts: (): Product[] => {
    const data = localStorage.getItem(KEYS.PRODUCTS);
    if (!data) {
      localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(PRODUCTS));
      return PRODUCTS;
    }
    return JSON.parse(data);
  },
  saveProducts: (products: Product[]) => {
    localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(products));
  },

  // Orders
  getOrders: (): Order[] => {
    const data = localStorage.getItem(KEYS.ORDERS);
    if (!data) {
      localStorage.setItem(KEYS.ORDERS, JSON.stringify(INITIAL_ORDERS));
      return INITIAL_ORDERS;
    }
    return JSON.parse(data);
  },
  saveOrders: (orders: Order[]) => {
    localStorage.setItem(KEYS.ORDERS, JSON.stringify(orders));
  },
  addOrder: (order: Order) => {
    const orders = storage.getOrders();
    orders.unshift(order);
    storage.saveOrders(orders);
  },

  // Users
  getUsers: (): User[] => {
    const data = localStorage.getItem(KEYS.USERS);
    if (!data) {
      localStorage.setItem(KEYS.USERS, JSON.stringify(INITIAL_USERS));
      return INITIAL_USERS;
    }
    return JSON.parse(data);
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
      // Deep merge with DEFAULT_SITE_CONTENT to ensure all properties exist
      return {
        ...DEFAULT_SITE_CONTENT,
        ...parsedData,
        homepage: { ...DEFAULT_SITE_CONTENT.homepage, ...(parsedData.homepage || {}) },
        ourStory: { ...DEFAULT_SITE_CONTENT.ourStory, ...(parsedData.ourStory || {}) },
        craftsmanship: { ...DEFAULT_SITE_CONTENT.craftsmanship, ...(parsedData.craftsmanship || {}) },
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
    const oldHomeData = localStorage.getItem('luxardo_home_content');
    if (oldHomeData) {
      const homeContent = JSON.parse(oldHomeData);
      const newContent = { ...DEFAULT_SITE_CONTENT, homepage: { ...DEFAULT_SITE_CONTENT.homepage, ...homeContent } };
      localStorage.setItem(KEYS.SITE_CONTENT, JSON.stringify(newContent));
      localStorage.removeItem('luxardo_home_content');
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
  getPolicies: () => {
    const data = localStorage.getItem(KEYS.POLICIES);
    if (!data) {
      localStorage.setItem(KEYS.POLICIES, JSON.stringify(INITIAL_POLICIES));
      return INITIAL_POLICIES;
    }
    const parsedData = JSON.parse(data);
    // Ensure all policies have all required fields
    const mergedPolicies = { ...INITIAL_POLICIES };
    Object.keys(mergedPolicies).forEach((key) => {
      if (parsedData[key]) {
        mergedPolicies[key as keyof typeof INITIAL_POLICIES] = {
          ...mergedPolicies[key as keyof typeof INITIAL_POLICIES],
          ...parsedData[key]
        };
      }
    });
    return mergedPolicies;
  },
  savePolicies: (policies: any) => {
    localStorage.setItem(KEYS.POLICIES, JSON.stringify(policies));
  },

  // Bespoke Requests
  getBespokeRequests: (): any[] => {
    const data = localStorage.getItem('luxardo_bespoke_requests');
    return data ? JSON.parse(data) : [];
  },
  saveBespokeRequests: (requests: any[]) => {
    localStorage.setItem('luxardo_bespoke_requests', JSON.stringify(requests));
  },
  addBespokeRequest: (request: any) => {
    const requests = storage.getBespokeRequests();
    requests.unshift(request);
    storage.saveBespokeRequests(requests);
  },

  // Wholesale Inquiries
  getWholesaleInquiries: (): any[] => {
    const data = localStorage.getItem('luxardo_wholesale_inquiries');
    return data ? JSON.parse(data) : [];
  },
  saveWholesaleInquiries: (inquiries: any[]) => {
    localStorage.setItem('luxardo_wholesale_inquiries', JSON.stringify(inquiries));
  },
  addWholesaleInquiry: (inquiry: any) => {
    const inquiries = storage.getWholesaleInquiries();
    inquiries.unshift(inquiry);
    storage.saveWholesaleInquiries(inquiries);
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
    const data = localStorage.getItem(`luxardo_saved_address_${userId}`);
    return data ? JSON.parse(data) : null;
  },
  saveAddress: (userId: string, address: any) => {
    localStorage.setItem(`luxardo_saved_address_${userId}`, JSON.stringify(address));
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
    if (productsChanged) storage.saveProducts(updatedProducts);

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

  // Dispatch Management
  getDispatchUsers: (): DispatchUser[] => {
    const data = localStorage.getItem(KEYS.DISPATCH_USERS);
    if (!data) {
      localStorage.setItem(KEYS.DISPATCH_USERS, JSON.stringify(INITIAL_DISPATCH_USERS));
      return INITIAL_DISPATCH_USERS;
    }
    return JSON.parse(data);
  },
  saveDispatchUsers: (users: DispatchUser[]) => {
    localStorage.setItem(KEYS.DISPATCH_USERS, JSON.stringify(users));
  },
  getDispatchSettings: (): DispatchSettings => {
    const data = localStorage.getItem(KEYS.DISPATCH_SETTINGS);
    if (!data) {
      localStorage.setItem(KEYS.DISPATCH_SETTINGS, JSON.stringify(DEFAULT_DISPATCH_SETTINGS));
      return DEFAULT_DISPATCH_SETTINGS;
    }
    return JSON.parse(data);
  },
  saveDispatchSettings: (settings: DispatchSettings) => {
    localStorage.setItem(KEYS.DISPATCH_SETTINGS, JSON.stringify(settings));
  }
};
