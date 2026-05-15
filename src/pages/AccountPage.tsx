import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { storage } from '../utils/localStorage';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatCurrency } from '../utils/currency';

import {
  collection as firestoreCollection,
  query as firestoreQuery,
  where,
  getDocs
} from 'firebase/firestore';

import { db, auth } from '../firebase';

import {
  User,
  Package,
  Heart,
  Settings,
  LogOut,
  Crown,
  MapPin,
  X
} from 'lucide-react';

export default function AccountPage() {
  const { user, logout } = useAuth();
  const { addToCart } = useCart();
  const { wishlist, removeFromWishlist } = useWishlist();

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState(
    searchParams.get('tab') || 'profile'
  );

  const [trackingInput, setTrackingInput] = useState('');
  const [trackedOrder, setTrackedOrder] = useState<{
    id: string;
    status: string;
  } | null>(null);

  const [globalSettings, setGlobalSettings] =
    useState(storage.getPrimeGlobalSettings());

  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);

  const handleTrackOrder = (orderId: string) => {
    setTrackingInput(orderId);

    let status = 'Order Placed';

    if (orderId === 'LX-8291') status = 'Delivered';
    else if (orderId === 'LX-7102') status = 'Processing';

    setTrackedOrder({
      id: orderId,
      status
    });

    setActiveTab('track-order');
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user?.id) return;

      setOrdersLoading(true);

      try {
        const uid = auth.currentUser?.uid || user.id;

        const ordersRef = firestoreCollection(db, 'orders');

        const q = firestoreQuery(
          ordersRef,
          where('userId', '==', uid)
        );

        const snapshot = await getDocs(q);

        const fetched = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        }));

        fetched.sort(
          (a: any, b: any) =>
            (b.createdAt || '').localeCompare(a.createdAt || '')
        );

        setOrders(fetched);

        const addrs: any[] = [];
        const seen = new Set();

        fetched.forEach((o: any) => {
          if (o.shippingAddress) {
            const key = `${o.shippingAddress.addressLine1}-${o.shippingAddress.postalCode}`;

            if (!seen.has(key)) {
              seen.add(key);
              addrs.push(o.shippingAddress);
            }
          }
        });

        setSavedAddresses(addrs);
      } catch (err) {
        console.error('Failed to fetch orders:', err);
      } finally {
        setOrdersLoading(false);
      }
    };

    fetchOrders();
  }, [user]);

  useEffect(() => {
    const tab = searchParams.get('tab');

    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    setGlobalSettings(storage.getPrimeGlobalSettings());
  }, []);

  if (!user) return null;

  const tabs = [
    {
      id: 'profile',
      label: 'Profile Overview',
      icon: <User size={18} />
    },
    {
      id: 'orders',
      label: 'My Orders',
      icon: <Package size={18} />
    },
    {
      id: 'favorites',
      label: 'My Favorites',
      icon: <Heart size={18} />
    },
    {
      id: 'track-order',
      label: 'Track Order',
      icon: <MapPin size={18} />
    },
    {
      id: 'membership',
      label: 'Membership Status',
      icon: <Crown size={18} />
    },
    {
      id: 'addresses',
      label: 'Saved Addresses',
      icon: <MapPin size={18} />
    },
    {
      id: 'account-details',
      label: 'Account Details',
      icon: <Settings size={18} />
    }
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-brand-bg">
      <section className="bg-brand-black text-brand-white pt-32 pb-20">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="flex items-center gap-4 flex-wrap">
            <h1 className="text-4xl md:text-6xl font-display tracking-tight">
              Welcome, {user.name.split(' ')[0]}
            </h1>

            {user.isPrimeMember && (
              <span className="px-3 py-1 bg-brand-white text-brand-black text-[10px] uppercase tracking-widest font-bold flex items-center gap-2">
                <Crown size={12} />
                Prime
              </span>
            )}
          </div>

          <p className="font-sans text-brand-white/60 text-lg mt-4">
            Manage your orders, bespoke requests, and styling profile.
          </p>
        </div>
      </section>

      <div className="max-w-[1400px] mx-auto px-6 py-12">
        <div className="flex flex-col lg:flex-row gap-12">

          {/* Sidebar */}
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
              className="w-full flex items-center gap-4 px-6 py-4 text-[11px] uppercase tracking-widest font-bold transition-all border bg-brand-white text-brand-secondary border-brand-divider hover:border-brand-black mt-8"
            >
              <LogOut size={18} />
              Logout
            </button>
          </aside>

          {/* Main Content */}
          <main className="flex-1">

            {/* PROFILE */}
            {activeTab === 'profile' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-8"
              >
                <h3 className="text-3xl font-display">
                  Profile Overview
                </h3>

                <div className="bg-brand-white p-8 border border-brand-divider">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary">
                        Full Name
                      </p>
                      <p className="mt-2 font-sans">
                        {user.name}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary">
                        Email Address
                      </p>
                      <p className="mt-2 font-sans">
                        {user.email}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary">
                        Phone Number
                      </p>
                      <p className="mt-2 font-sans">
                        {user.phone || 'Not Provided'}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary">
                        Total Orders
                      </p>
                      <p className="mt-2 font-sans">
                        {orders.length}
                      </p>
                    </div>

                  </div>
                </div>
              </motion.div>
            )}

            {/* ORDERS */}
            {activeTab === 'orders' && (
              <div className="space-y-6">
                <h3 className="text-3xl font-display">
                  My Orders
                </h3>

                {ordersLoading ? (
                  <div className="bg-brand-white border border-brand-divider p-12 text-center">
                    Loading orders...
                  </div>
                ) : orders.length === 0 ? (
                  <div className="bg-brand-white border border-brand-divider p-12 text-center">
                    No orders found.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {orders.map((order) => (
                      <div
                        key={order.id}
                        className="bg-brand-white p-6 border border-brand-divider"
                      >
                        <div className="flex justify-between border-b border-brand-divider pb-6 flex-wrap gap-6">
                          <div>
                            <p className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary">
                              Order ID
                            </p>
                            <p className="font-bold">
                              LX-{order.id.slice(-8).toUpperCase()}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary">
                              Total
                            </p>
                            <p>
                              {formatCurrency(order.totalAmount || order.total)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary">
                              Status
                            </p>
                            <p className="capitalize">
                              {order.status || 'Processing'}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-4 mt-6">
                          {order.items?.map((item: any, idx: number) => (
                            <div
                              key={idx}
                              className="flex items-center gap-6"
                            >
                              <img
                                src={item.image}
                                alt={item.name}
                                className="w-20 h-24 object-cover"
                              />
                              <div className="flex-1">
                                <h4 className="font-display text-lg">
                                  {item.name}
                                </h4>
                                <p className="text-sm text-brand-secondary">
                                  Qty: {item.quantity}
                                </p>
                              </div>
                              <button
                                onClick={() => {
                                  const product = storage
                                    .getProducts()
                                    .find((p) => p.id === item.productId);

                                  if (product) {
                                    addToCart(product, 1);
                                    navigate('/cart');
                                  }
                                }}
                                className="btn-primary px-6 py-2 text-[10px]"
                              >
                                Reorder
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* FAVORITES */}
            {activeTab === 'favorites' && (
              <div className="space-y-6">
                <h3 className="text-3xl font-display">
                  My Favorites
                </h3>

                {wishlist.length === 0 ? (
                  <div className="bg-brand-white border border-brand-divider p-12 text-center">
                    No favorite products yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {wishlist.map((item) => (
                      <div
                        key={item.id}
                        className="bg-brand-white border border-brand-divider p-4 relative"
                      >
                        <button
                          onClick={() => removeFromWishlist(item.id)}
                          className="absolute top-4 right-4"
                        >
                          <X size={18} />
                        </button>
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full aspect-[3/4] object-cover"
                        />
                        <div className="mt-4">
                          <h4 className="font-display text-lg">
                            {item.name}
                          </h4>
                          <p className="text-brand-secondary mt-1">
                            {formatCurrency(item.price)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}