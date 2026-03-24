export type PagePath = 
  | '/' 
  | '/collections'
  | '/collections/kurta-editions' 
  | '/collections/formal-tailoring'
  | '/collections/tailored-sets'
  | '/collections/koti-ensembles'
  | '/collections/bomber-jackets'
  | '/prime-membership'
  | '/private-client-services'
  | '/private-client-services/bespoke-request'
  | '/private-client-services/style-consultation'
  | '/private-client-services/fabric-library'
  | '/private-client-services/member-benefits'
  | '/craftsmanship'
  | '/our-story'
  | '/wholesale'
  | '/contact'
  | '/faq'
  | '/policies/shipping'
  | '/policies/returns'
  | '/policies/privacy'
  | '/policies/terms'
  | '/cart'
  | '/checkout'
  | '/account'
  | '/sign-in'
  | '/product'
  | '/admin/media'
  | '/admin/dispatch-management';

export interface Currency {
  code: string;
  symbol: string;
  rate: number;
}

export interface Country {
  name: string;
  code: string;
  currency: Currency;
  active: boolean;
}

export type Language = 'English (US)' | 'French' | 'Arabic';

export interface Product {
  id: string;
  name: string;
  slug?: string;
  price: number; // Base price in INR
  category: string;
  collection?: string;
  image: string;
  images?: string[];
  description: string;
  productStory?: string;
  stock?: number;
  visibility?: 'public' | 'hidden';
  featured?: boolean;
  readyToStitch?: boolean;
  readyToStitchInfo?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  isPrimeMember: boolean;
  membershipActivation?: string;
  membershipExpiry?: string;
  phone?: string;
  country?: string;
  createdAt?: string;
  primePrivileges?: {
    consultation: boolean;
    bespoke: boolean;
    fabricLibrary: boolean;
    prioritySupport: boolean;
  };
  notes?: string;
}

export interface Order {
  id: string;
  userId?: string;
  userName: string;
  userEmail: string;
  totalAmount: number;
  status: 'pending' | 'processing' | 'packed' | 'shipped' | 'delivered' | 'cancelled' | 'returned' | 'failed_delivery';
  verificationStatus?: 'verified' | 'packing_ready' | 'dispatch_ready';
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'refunded';
  paymentMethod?: 'cod' | 'prepaid';
  trackingId?: string;
  courierName?: string;
  dispatchDate?: string;
  dispatchNote?: string;
  internalRemarks?: string;
  statusHistory?: {
    status: string;
    timestamp: string;
    note?: string;
  }[];
  createdAt: string;
  items: {
    productId: string;
    name: string;
    price: number;
    quantity: number;
    image?: string;
    category?: string;
  }[];
  shippingAddress?: {
    fullName: string;
    email: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

export interface MediaItem {
  id: string;
  url: string;
  name: string;
  type: 'product' | 'homepage' | 'content' | 'other';
  uploadDate: string;
  size?: string;
  dimensions?: string;
}

export interface DispatchPermissions {
  canVerifyOrders: boolean;
  canMarkPacked: boolean;
  canMarkShipped: boolean;
  canMarkDelivered: boolean;
  canEditTrackingId: boolean;
  canViewCustomerAddress: boolean;
  canExportOrders: boolean;
}

export interface DispatchUser {
  id: string;
  fullName: string;
  username: string;
  password?: string;
  role: string;
  status: 'active' | 'disabled';
  permissions: DispatchPermissions;
  createdAt: string;
  lastLogin?: string;
}

export interface DispatchSettings {
  defaultStatuses: string[];
  verificationWorkflow: 'simple' | 'strict';
  courierFieldsVisible: boolean;
  trackingIdRequired: boolean;
  dispatchNotesEnabled: boolean;
}
