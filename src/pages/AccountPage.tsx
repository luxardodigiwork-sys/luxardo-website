import React, { useState, useEffect } from 'react';
import { PRIME_AVAILABLE } from '../constants/features';
import { SectionHeader } from '../components/SectionHeader';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { storage } from '../utils/localStorage';
import { useProducts } from '../context/ProductsContext';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { GoogleAuthProvider, linkWithPopup } from 'firebase/auth';
import { authErrorMessage } from '../utils/loginFlow';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { formatCurrency } from '../utils/currency';
import { 
  User, 
  Package, 
  Heart, 
  Ruler, 
  Settings, 
  LogOut, 
  Crown, 
  ChevronRight, 
  MapPin,
  CreditCard,
  Bell,
  ShieldCheck,
  MessageSquare,
  X
} from 'lucide-react';

export default function AccountPage() {
  useProducts(); // re-render when the live catalogue changes (product images)
  const { user, logout } = useAuth();
  const { addToCart } = useCart();
  const { wishlist, removeFromWishlist } = useWishlist();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const safeTab = (t: string | null) => (!t || (t === 'membership' && !PRIME_AVAILABLE) ? 'profile' : t);
  const [activeTab, setActiveTab] = useState(safeTab(searchParams.get('tab')));
  const [googleLinked, setGoogleLinked] = useState(!!auth.currentUser?.providerData.some((p) => p.providerId === 'google.com'));
  const [linkMessage, setLinkMessage] = useState('');
  // Adds Google to THIS account (same uid, same profile and orders). It never creates a second account.
  const handleLinkGoogle = async () => {
    setLinkMessage('');
    try {
      if (!auth.currentUser) throw new Error('not-signed-in');
      await linkWithPopup(auth.currentUser, new GoogleAuthProvider());
      setGoogleLinked(true);
      setLinkMessage('Google is now linked to your account.');
    } catch (err) {
      setLinkMessage(authErrorMessage(err));
    }
  };
  const [trackingInput, setTrackingInput] = useState('');
  const [globalSettings, setGlobalSettings] = useState(storage.getPrimeGlobalSettings());

  // Naya Firebase Fetch Logic
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  // Tracking is shown only from real order data (Firestore) on the order tracking page, which also
  // checks the order belongs to the signed-in customer. No order IDs or statuses are hardcoded here.
  const handleTrackOrder = (orderId: string) => {
    const id = orderId.trim();
    if (id) navigate(`/track-order/${encodeURIComponent(id)}`);
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  useEffect(() => {
    const tab = safeTab(searchParams.get('tab'));
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    setGlobalSettings(storage.getPrimeGlobalSettings());
  }, []);

  // Firebase se orders lane ka Effect
  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) return;
      setOrdersLoading(true);
      try {
        const uid = auth.currentUser?.uid || user.id;
        const ordersRef = collection(db, 'orders');
        const q = query(ordersRef, where('userId', '==', uid));
        const snapshot = await getDocs(q);
        
        const fetchedOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Latest order pehle dikhane ke liye sort karein
        fetchedOrders.sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        
        setOrders(fetchedOrders);
      } catch (error) {
        console.error("Orders fetch karne mein error:", error);
      } finally {
        setOrdersLoading(false);
      }
    };

    fetchOrders();
  }, [user]);

  if (!user) return null;

  const tabs = [
    { id: 'profile', label: 'Profile Overview', icon: <User size={18} /> },
    { id: 'orders', label: 'My Orders', icon: <Package size={18} /> },
    { id: 'favorites', label: 'My Favorites', icon: <Heart size={18} /> },
    { id: 'track-order', label: 'Track Order', icon: <MapPin size={18} /> },
    ...(PRIME_AVAILABLE ? [{ id: 'membership', label: 'Membership Status', icon: <Crown size={18} /> }] : []),
    { id: 'addresses', label: 'Saved Addresses', icon: <MapPin size={18} /> },
    { id: 'account-details', label: 'Account Details', icon: <Settings size={18} /> },
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-brand-bg">
      {/* Header */}
      <section className="bg-brand-black text-brand-white pt-32 pb-20">
        <div className="max-w-[1400px] mx-auto px-6 flex flex-col md:flex-row justify-between items-end gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <h1 className="text-4xl md:text-6xl font-display tracking-tight">
                Welcome, {user.name.split(' ')[0]}
              </h1>
              {PRIME_AVAILABLE && user.isPrimeMember && (
                <span className="px-3 py-1 bg-brand-white text-brand-black text-[10px] uppercase tracking-widest font-bold flex items-center gap-2">
                  <Crown size={12} /> Prime
                </span>
              )}
            </div>
            <p className="font-sans text-brand-white/60 text-lg">
              Manage your orders, bespoke requests, and styling profile.
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-[1400px] mx-auto px-6 py-12">
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Sidebar Navigation */}
          <aside className="lg:w-64 space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-4 px-6 py-4 text-[11px] uppercase tracking-widest font-bold transition-all border ${
                  activeTab === tab.id 
                    ? 'bg-brand-black text-brand-white border-brand-black' 
                    : 'bg-brand-white text-brand-secondary border-brand-divider hover:border-brand-black'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-4 px-6 py-4 text-[11px] uppercase tracking-widest font-bold transition-all border bg-brand-white text-brand-secondary border-brand-divider hover:border-brand-black hover:text-brand-black mt-8"
            >
              <LogOut size={18} />
              Logout
            </button>
          </aside>

          {/* Content Area */}
          <main className="flex-1 min-h-[600px]">
            <AnimatePresence mode="wait">
              {activeTab === 'profile' && (
                <motion.div
                  key="profile"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-8"
                >
                  <h3 className="text-3xl font-display">Profile Overview</h3>
                  
                  <div className="bg-brand-white p-8 border border-brand-divider space-y-6">
                    <div className="flex items-center justify-between border-b border-brand-divider pb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-brand-bg rounded-full flex items-center justify-center text-xl font-display">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="text-xl font-display">{user.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            {PRIME_AVAILABLE && user.isPrimeMember ? (
                              <span className="px-2 py-0.5 bg-brand-black text-brand-white text-[10px] uppercase tracking-widest font-bold flex items-center gap-1">
                                <Crown size={10} /> Prime Member
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-brand-bg text-brand-secondary text-[10px] uppercase tracking-widest font-bold">
                                Standard Customer
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button onClick={() => setActiveTab('settings')} className="text-[11px] uppercase tracking-widest font-bold border-b border-brand-black pb-1">
                        Edit Profile
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary">Email Address</p>
                        <p className="font-sans text-brand-black">{user.email}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary">Phone Number</p>
                        <p className="font-sans text-brand-black">{user.phone || 'Not provided'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary">Country</p>
                        <p className="font-sans text-brand-black">{user.country || 'Not provided'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary">Total Orders</p>
                        <p className="font-sans text-brand-black">{orders.length > 0 ? `${orders.length} order${orders.length > 1 ? 's' : ''}` : 'No orders yet'}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'orders' && (
                <motion.div
                  key="orders"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <h3 className="text-3xl font-display">My Orders</h3>
                  
                  {(() => {
                    if (ordersLoading) {
                      return (
                        <div className="bg-brand-white border border-brand-divider p-12 text-center space-y-6">
                          <div className="w-8 h-8 border-4 border-brand-divider border-t-brand-black rounded-full animate-spin mx-auto"></div>
                          <p className="font-sans text-brand-secondary max-w-lg mx-auto leading-relaxed">
                            Loading your orders...
                          </p>
                        </div>
                      );
                    }

                    if (orders.length === 0) {
                      return (
                        <div className="bg-brand-white border border-brand-divider p-12 text-center space-y-6">
                          <Package size={48} className="mx-auto text-brand-divider" />
                          <p className="font-sans text-brand-secondary max-w-lg mx-auto leading-relaxed">
                            You have not placed any orders yet.
                          </p>
                          <button 
                            onClick={() => navigate('/collections')}
                            className="btn-primary px-12"
                          >
                            Explore Collections
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-6">
                        {orders.map((order) => (
                          <div key={order.id} className="bg-brand-white p-6 border border-brand-divider space-y-6">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-brand-divider pb-6">
                              <div className="flex gap-8">
                                <div className="space-y-1">
                                  <p className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary">Order ID</p>
                                  <p className="font-sans text-brand-black font-bold">LX-{order.id.slice(-8).toUpperCase()}</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary">Date</p>
                                  <p className="font-sans text-brand-black">{new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary">Total Amount</p>
                                  <p className="font-sans text-brand-black">{formatCurrency(order.totalAmount || order.total)}</p>
                                </div>
                              </div>
                              <div className="flex gap-4">
                                <div className="space-y-1 text-right">
                                  <p className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary">Status</p>
                                  <p className="font-sans text-brand-black capitalize">{order.status}</p>
                                </div>
                              </div>
                            </div>
                            
                            <div className="space-y-4">
                              {order.items?.map((item: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-6">
                                  <Link to={`/product/${item.productId}`} className="w-20 h-24 bg-brand-bg overflow-hidden block shrink-0">
                                    <img src={storage.getProducts().find(p => p.id === item.productId)?.image || item.image} alt={item.title || item.name || "Product"} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
                                  </Link>
                                  <div className="flex-1">
                                    <Link to={`/product/${item.productId}`}>
                                      <h4 className="font-display text-lg hover:text-brand-secondary transition-colors">{item.name || item.title}</h4>
                                    </Link>
                                    <p className="text-sm font-sans text-brand-secondary">Qty: {item.quantity}</p>
                                  </div>
                                  <div>
                                    <button 
                                      onClick={() => {
                                        const product = storage.getProducts().find(p => p.id === item.productId);
                                        if (product) {
                                          addToCart(product, 1);
                                          navigate('/cart');
                                        }
                                      }}
                                      className="btn-primary px-6 py-2 text-[10px] whitespace-nowrap"
                                    >
                                      Reorder
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>

                            <div className="pt-6 border-t border-brand-divider flex justify-end gap-6">
                              <button 
                                onClick={() => handleTrackOrder(order.id)}
                                className="text-[11px] uppercase tracking-widest font-bold border-b border-brand-black pb-1 hover:text-brand-secondary hover:border-brand-secondary transition-colors"
                              >
                                Track Order
                              </button>
                              <Link 
                                to={`/account/orders/${order.id}`}
                                className="text-[11px] uppercase tracking-widest font-bold border-b border-brand-black pb-1 hover:text-brand-secondary hover:border-brand-secondary transition-colors"
                              >
                                View Order Details
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </motion.div>
              )}

              {activeTab === 'membership' && (
                <motion.div
                  key="membership"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-8"
                >
                  <h3 className="text-3xl font-display">Membership Status</h3>
                  {user.isPrimeMember ? (
                    <div className="bg-brand-white p-10 border border-brand-divider space-y-8">
                      <div className="flex items-center gap-4">
                        <Crown size={24} className="text-brand-black" />
                        <h4 className="text-2xl font-display">Prime Member Active</h4>
                      </div>
                      
                      {!globalSettings.isLive && (
                        <div className="bg-amber-50 border border-amber-200 p-4 text-amber-800 text-sm font-sans">
                          {globalSettings.offlineMessage}
                        </div>
                      )}
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-brand-divider">
                        <div className="space-y-2">
                          <p className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary">Activation Date</p>
                          <p className="font-sans text-brand-black">{user.membershipActivation || 'October 12, 2024'}</p>
                        </div>
                        <div className="space-y-2">
                          <p className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary">Expiry Date</p>
                          <p className="font-sans text-brand-black">{user.membershipExpiry || 'October 12, 2025'}</p>
                        </div>
                      </div>

                      <div className="pt-6">
                        <button 
                          onClick={() => navigate('/prime-membership')} 
                          className="btn-primary px-8 py-3"
                        >
                          View Membership Benefits
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-brand-white p-10 border border-brand-divider space-y-8">
                      <div className="space-y-2">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary">Membership Status</p>
                        <h4 className="text-2xl font-display text-brand-black">Standard Account</h4>
                      </div>
                      
                      {!globalSettings.isLive && (
                        <div className="bg-amber-50 border border-amber-200 p-4 text-amber-800 text-sm font-sans">
                          {globalSettings.offlineMessage}
                        </div>
                      )}
                      
                      <div className="pt-6 border-t border-brand-divider">
                        <button 
                          onClick={() => navigate('/prime-membership')} 
                          className="btn-primary px-8 py-3"
                        >
                          {globalSettings.isLive ? 'Upgrade to Prime Member' : 'View Membership Details'}
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'favorites' && (
                <motion.div
                  key="favorites"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <h3 className="text-3xl font-display">My Favorites</h3>
                  
                  {wishlist.length === 0 ? (
                    <div className="bg-brand-white border border-brand-divider p-12 text-center space-y-6">
                      <Heart size={48} className="mx-auto text-brand-divider" />
                      <p className="font-sans text-brand-secondary max-w-lg mx-auto leading-relaxed">
                        You haven't added any items to your favorites yet.
                      </p>
                      <button 
                        onClick={() => navigate('/collections')}
                        className="btn-primary px-12"
                      >
                        Explore Collections
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {wishlist.map((item) => (
                        <div key={item.id} className="bg-brand-white border border-brand-divider group relative">
                          <button 
                            onClick={() => removeFromWishlist(item.id)}
                            className="absolute top-4 right-4 z-10 w-8 h-8 bg-brand-white rounded-full flex items-center justify-center shadow-sm hover:bg-brand-black hover:text-brand-white transition-colors"
                          >
                            <X size={14} />
                          </button>
                          <Link to={`/product/${item.id}`} className="block aspect-[3/4] overflow-hidden">
                            <img 
                              src={item.image} 
                              alt={item.name} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                              referrerPolicy="no-referrer"
                            />
                          </Link>
                          <div className="p-4 space-y-2">
                            <p className="text-[9px] uppercase tracking-[0.2em] font-bold text-brand-secondary">{item.category}</p>
                            <Link to={`/product/${item.id}`}>
                              <h4 className="font-sans font-medium text-brand-black group-hover:text-brand-secondary transition-colors line-clamp-1">{item.name}</h4>
                            </Link>
                            <p className="text-sm font-sans text-brand-secondary">{formatCurrency(item.price)}</p>
                            <button 
                              onClick={() => {
                                addToCart(item, 1);
                                navigate('/cart');
                              }}
                              className="w-full btn-primary py-2 mt-4 text-[10px]"
                            >
                              Add to Cart
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'track-order' && (
                <motion.div
                  key="track-order"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-8"
                >
                  <h3 className="text-3xl font-display">Track Order</h3>
                  <div className="bg-brand-white p-8 border border-brand-divider space-y-6">
                    <p className="font-sans text-brand-secondary">
                      Enter your order ID to see its current status and courier tracking details.
                    </p>
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (trackingInput.trim()) {
                          handleTrackOrder(trackingInput.trim());
                        }
                      }}
                      className="flex flex-col md:flex-row gap-4"
                    >
                      <input 
                        type="text" 
                        value={trackingInput}
                        onChange={(e) => setTrackingInput(e.target.value)}
                        placeholder="Paste your order ID" 
                        className="flex-1 bg-brand-bg border border-brand-divider px-4 py-3 font-sans focus:outline-none focus:border-brand-black" 
                      />
                      <button type="submit" className="btn-primary px-8 py-3">
                        Track Now
                      </button>
                    </form>
                  </div>

                </motion.div>
              )}

              {activeTab === 'addresses' && (
                <motion.div
                  key="addresses"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-8"
                >
                  <div className="flex justify-between items-end">
                    <h3 className="text-3xl font-display">Saved Addresses</h3>
                    <button className="text-[11px] uppercase tracking-widest font-bold border-b border-brand-black pb-1">
                      Add New Address
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-brand-white p-8 border border-brand-black space-y-4 relative">
                      <span className="absolute top-4 right-4 text-[10px] uppercase tracking-widest font-bold bg-brand-black text-brand-white px-2 py-1">Default</span>
                      <h4 className="font-sans font-bold text-brand-black">{user.name}</h4>
                      <p className="font-sans text-brand-secondary text-sm leading-relaxed">
                        Address saving feature <br />
                        will be available soon.<br />
                        Thank you for your patience.
                      </p>
                      <div className="pt-4 flex gap-4">
                        <button className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary hover:text-brand-black">Edit</button>
                        <button className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary hover:text-brand-black">Delete</button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'account-details' && (
                <motion.div
                  key="account-details"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-8"
                >
                  <h3 className="text-3xl font-display">Account Details</h3>
                  <div className="space-y-6">
                    <div className="bg-brand-white p-8 border border-brand-divider space-y-6">
                      <h4 className="text-[11px] uppercase tracking-widest font-bold flex items-center gap-2">
                        <User size={16} /> Personal Information
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary">Full Name</label>
                          <input type="text" readOnly defaultValue={user.name} className="w-full bg-brand-bg border border-brand-divider px-4 py-3 font-sans focus:outline-none focus:border-brand-black" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary">Email Address</label>
                          <input type="email" readOnly defaultValue={user.email} className="w-full bg-brand-bg border border-brand-divider px-4 py-3 font-sans focus:outline-none focus:border-brand-black" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary">Phone Number</label>
                          <input type="tel" readOnly defaultValue={user.phone} className="w-full bg-brand-bg border border-brand-divider px-4 py-3 font-sans focus:outline-none focus:border-brand-black" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary">Country</label>
                          <input type="text" readOnly defaultValue={user.country} className="w-full bg-brand-bg border border-brand-divider px-4 py-3 font-sans focus:outline-none focus:border-brand-black" />
                        </div>
                      </div>
                      <p className="text-xs font-sans text-brand-secondary">Profile editing is not available yet.</p>
                    </div>

                    <div className="bg-brand-white p-8 border border-brand-divider space-y-4">
                      <h4 className="text-[11px] uppercase tracking-widest font-bold">Sign-in methods</h4>
                      <p className="text-sm font-sans text-brand-secondary">Mobile number: {auth.currentUser?.phoneNumber || 'not verified'}</p>
                      {googleLinked ? (
                        <p className="text-sm font-sans text-brand-secondary">Google: linked</p>
                      ) : (
                        <button type="button" onClick={handleLinkGoogle} className="btn-outline px-6 py-3 text-[10px]">Link Google account</button>
                      )}
                      {linkMessage && <p className="text-xs font-sans text-brand-secondary">{linkMessage}</p>}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
}