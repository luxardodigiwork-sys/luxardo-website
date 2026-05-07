#!/usr/bin/env python3
"""
Fix AccountPage.tsx: Replace localStorage orders with Firestore queries.
Run this in the Codespace root: python3 fix_account_orders.py
"""
import re

filepath = "src/pages/AccountPage.tsx"

with open(filepath, "r") as f:
    content = f.read()

# 1. Add Firestore imports at the top (after existing imports)
old_import = "import { storage } from '../utils/localStorage';"
new_import = """import { storage } from '../utils/localStorage';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';"""
content = content.replace(old_import, new_import)

# 2. Replace static orders with state + Firestore useEffect
old_orders = "  const orders = storage.getOrders().filter(o => o.userId === user?.id);"
new_orders = """  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);"""
content = content.replace(old_orders, new_orders)

# 3. Add useEffect to fetch orders from Firestore (after the searchParams useEffect)
old_tab_effect = """  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) {
      setActiveTab(tab);"""
new_tab_effect = """  // Fetch orders from Firestore
  useEffect(() => {
    const fetchOrders = async () => {
      if (!user?.id) return;
      setOrdersLoading(true);
      try {
        const uid = auth.currentUser?.uid || user.id;
        const ordersRef = collection(db, 'orders');
        const q = query(ordersRef, where('userId', '==', uid));
        const snapshot = await getDocs(q);
        const fetched = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        fetched.sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setOrders(fetched);

        // Extract unique addresses from orders for Saved Addresses
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
      setActiveTab(tab);"""
content = content.replace(old_tab_effect, new_tab_effect)

# 4. Fix handleTrackOrder to use real order data from Firestore
old_track = """  const handleTrackOrder = (orderId: string) => {
    setTrackingInput(orderId);
    // Mock tracking logic
    let status = 'Order Placed';
    if (orderId === 'LX-8291') status = 'Delivered';
    else if (orderId === 'LX-7102') status = 'Processing';

    setTrackedOrder({ id: orderId, status });
    setActiveTab('track-order');
  };"""
new_track = """  const handleTrackOrder = (orderId: string) => {
    setTrackingInput(orderId);
    // Find order in fetched orders
    const cleanId = orderId.replace(/^#?LX-/i, '');
    const found = orders.find((o: any) =>
      o.id === orderId ||
      o.id.slice(-8).toUpperCase() === cleanId.toUpperCase() ||
      o.id === cleanId
    );
    if (found) {
      const statusMap: Record<string, string> = {
        'pending': 'Order Placed',
        'confirmed': 'Confirmed',
        'processing': 'Processing',
        'packed': 'Packed',
        'shipped': 'Shipped',
        'out_for_delivery': 'Out for Delivery',
        'delivered': 'Delivered',
      };
      setTrackedOrder({
        id: 'LX-' + found.id.slice(-8).toUpperCase(),
        status: statusMap[found.status] || found.status || 'Order Placed'
      });
    } else {
      setTrackedOrder({ id: orderId, status: 'Order Placed' });
    }
    setActiveTab('track-order');
  };"""
content = content.replace(old_track, new_track)

# 5. Fix order display — orders from Firestore use 'title' not 'name', and add loading state
old_orders_empty = """                  {(() => {
                    if (orders.length === 0) {
                      return (
                        <div className="bg-brand-white border border-brand-divider p-12 text-center space-y-6">
                          <Package size={48} className="mx-auto text-brand-divider" />
                          <p className="font-sans text-brand-secondary max-w-lg mx-auto leading-relaxed">
                            You have not placed any orders yet.
                          </p>"""
new_orders_empty = """                  {(() => {
                    if (ordersLoading) {
                      return (
                        <div className="bg-brand-white border border-brand-divider p-12 text-center">
                          <p className="font-sans text-brand-secondary">Loading your orders...</p>
                        </div>
                      );
                    }
                    if (orders.length === 0) {
                      return (
                        <div className="bg-brand-white border border-brand-divider p-12 text-center space-y-6">
                          <Package size={48} className="mx-auto text-brand-divider" />
                          <p className="font-sans text-brand-secondary max-w-lg mx-auto leading-relaxed">
                            You have not placed any orders yet.
                          </p>"""
content = content.replace(old_orders_empty, new_orders_empty)

# 6. Fix order ID display format
content = content.replace(
    '<p className="font-sans text-brand-black font-bold">#{order.id}</p>',
    '<p className="font-sans text-brand-black font-bold">LX-{order.id.slice(-8).toUpperCase()}</p>'
)

# 7. Fix order item image and name (Firestore uses 'title', not 'name')
content = content.replace(
    "src={storage.getProducts().find(p => p.id === item.productId)?.image}",
    "src={item.image || storage.getProducts().find(p => p.id === item.productId)?.image || '/placeholder.png'}"
)
content = content.replace(
    'alt={item.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"',
    'alt={item.title || item.name || "Product"} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"'
)
content = content.replace(
    '<h4 className="font-display text-lg hover:text-brand-secondary transition-colors">{item.name}</h4>',
    '<h4 className="font-display text-lg hover:text-brand-secondary transition-colors">{item.title || item.name || "Product"}</h4>'
)

# 8. Fix Saved Addresses section — replace hardcoded dummy address with real data from orders
old_addresses = """                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-brand-white p-8 border border-brand-black space-y-4 relative">
                      <span className="absolute top-4 right-4 text-[10px] uppercase tracking-widest font-bold bg-brand-black text-brand-white px-2 py-1">Default</span>
                      <h4 className="font-sans font-bold text-brand-black">Alexander Wright</h4>
                      <p className="font-sans text-brand-secondary text-sm leading-relaxed">
                        123 Luxury Lane, Suite 400<br />
                        Mumbai, Maharashtra 400001<br />
                        India
                      </p>
                      <div className="pt-4 flex gap-4">
                        <button className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary hover:text-brand-black">Edit</button>
                        <button className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary hover:text-brand-black">Delete</button>
                      </div>
                    </div>
                  </div>"""
new_addresses = """                  {savedAddresses.length === 0 ? (
                    <div className="bg-brand-white border border-brand-divider p-12 text-center space-y-6">
                      <MapPin size={48} className="mx-auto text-brand-divider" />
                      <p className="font-sans text-brand-secondary max-w-lg mx-auto leading-relaxed">
                        No saved addresses yet. Your shipping addresses will appear here after you place an order.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {savedAddresses.map((addr: any, idx: number) => (
                        <div key={idx} className={`bg-brand-white p-8 border ${idx === 0 ? 'border-brand-black' : 'border-brand-divider'} space-y-4 relative`}>
                          {idx === 0 && <span className="absolute top-4 right-4 text-[10px] uppercase tracking-widest font-bold bg-brand-black text-brand-white px-2 py-1">Default</span>}
                          <h4 className="font-sans font-bold text-brand-black">{addr.fullName}</h4>
                          <p className="font-sans text-brand-secondary text-sm leading-relaxed">
                            {addr.addressLine1}<br />
                            {addr.addressLine2 && <>{addr.addressLine2}<br /></>}
                            {addr.city}, {addr.state} {addr.postalCode}<br />
                            {addr.country || 'India'}
                          </p>
                          <p className="font-sans text-brand-secondary text-xs">{addr.phone}</p>
                        </div>
                      ))}
                    </div>
                  )}"""
content = content.replace(old_addresses, new_addresses)

# 9. Fix the profile overview section — show order count
content = content.replace(
    '<p className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary">Account Created</p>',
    '<p className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary">Total Orders</p>'
)

# Replace the account created date with order count
old_created = """user.createdAt || 'Unknown'"""
new_created = """orders.length > 0 ? `${orders.length} order${orders.length > 1 ? 's' : ''}` : 'No orders yet'"""
content = content.replace(old_created, new_created)

with open(filepath, "w") as f:
    f.write(content)

print("AccountPage.tsx updated successfully!")
print("Changes made:")
print("  1. Added Firestore imports")
print("  2. Orders now fetched from Firestore (not localStorage)")
print("  3. Track Order uses real order status")
print("  4. Saved Addresses populated from order shipping data")
print("  5. Fixed order item title/name mismatch")
print("  6. Order IDs show as LX-XXXXXXXX format")
print("  7. 'Account Created' replaced with 'Total Orders'")
print("  8. Loading state added for orders")
