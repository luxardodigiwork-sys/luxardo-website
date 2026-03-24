import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Users, ShoppingBag, IndianRupee, Package, Settings, CheckCircle2, AlertCircle, Clock, Truck, Mail, Plus, FileText, Shield, Image as ImageIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatINR } from '../../utils/currency';
import { useAuth } from '../../context/AuthContext';
import { storage } from '../../utils/localStorage';

export default function AdminDashboardPage() {
  const { isAuthReady } = useAuth();

  const dashboardData = useMemo(() => {
    if (!isAuthReady) return null;

    try {
      const data = storage.getDashboardStats();
      const orders = storage.getOrders();
      const products = storage.getProducts();
      const wholesaleInquiries = storage.getWholesaleInquiries();
      
      const today = new Date();
      const todayString = today.toDateString();
      const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      let todayRev = 0;
      let last7Rev = 0;
      let pendingCount = 0;
      let processingCount = 0;
      let shippedCount = 0;
      let deliveredCount = 0;
      let cancelledCount = 0;
      let hasOrdersToday = false;

      orders.forEach(o => {
        const orderDate = new Date(o.createdAt);
        if (orderDate.toDateString() === todayString) {
          todayRev += o.totalAmount;
          hasOrdersToday = true;
        }
        if (orderDate >= sevenDaysAgo) {
          last7Rev += o.totalAmount;
        }

        switch(o.status) {
          case 'pending': pendingCount++; break;
          case 'processing': processingCount++; break;
          case 'shipped': shippedCount++; break;
          case 'delivered': deliveredCount++; break;
          case 'cancelled': cancelledCount++; break;
        }
      });

      const pendingOrders = pendingCount + processingCount;
      const deliveredOrders = deliveredCount;

      // Generate Smart Alerts
      const newAlerts: string[] = [];
      if (pendingOrders > 5) {
        newAlerts.push('Orders require attention');
      }
      if (products.some(p => p.stock < 5)) {
        newAlerts.push('Low stock items detected');
      }
      if (!hasOrdersToday) {
        newAlerts.push('No orders today');
      }

      const orderStatuses = {
        pending: pendingCount,
        processing: processingCount,
        shipped: shippedCount,
        delivered: deliveredCount,
        cancelled: cancelledCount,
      };

      return {
        stats: {
          revenue: data.totalRevenue,
          todayRevenue: todayRev,
          last7DaysRevenue: last7Rev,
          totalOrders: data.totalOrders,
          pendingOrders,
          deliveredOrders,
          activePrimeMembers: data.activeMembers,
          totalProducts: products.length,
          wholesaleInquiries: wholesaleInquiries.length,
          orderStatuses
        },
        alerts: newAlerts,
        recentOrders: data.recentOrders,
        recentActivity: [
          { id: 1, text: 'New order #LX-8291 placed', time: '10 mins ago' },
          { id: 2, text: 'Product "Midnight Blue Bandhgala" added', time: '1 hour ago' },
          { id: 3, text: 'Order #LX-8285 shipped', time: '2 hours ago' },
          { id: 4, text: 'Alexander Wright activated Prime membership', time: '3 hours ago' },
          { id: 5, text: 'Shipping policy updated', time: '5 hours ago' },
        ]
      };
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      return null;
    }
  }, [isAuthReady]);

  if (!isAuthReady || !dashboardData) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-divider border-t-brand-black rounded-full animate-spin"></div>
          <p className="font-sans text-brand-secondary animate-pulse uppercase tracking-widest text-xs">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  const { stats, alerts, recentOrders, recentActivity } = dashboardData;

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20">
      {/* Header Section */}
      <div>
        <h1 className="text-3xl md:text-4xl font-display uppercase tracking-tight">Dashboard</h1>
        <p className="text-brand-secondary font-sans mt-2 text-sm">Luxardo business overview</p>
      </div>

      {/* Smart Alerts */}
      {alerts.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {alerts.map((alert, index) => (
            <div 
              key={index} 
              className="flex items-center gap-2 px-3 py-1.5 bg-brand-bg border border-brand-divider"
            >
              <div className="w-1 h-1 rounded-full bg-brand-black" />
              <span className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary">
                {alert}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Revenue Insights */}
      <section>
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-brand-secondary mb-4">Revenue Insights</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          {[
            { label: "Today's Revenue", value: formatINR(stats.todayRevenue), note: 'Since midnight' },
            { label: 'Last 7 Days', value: formatINR(stats.last7DaysRevenue), note: 'Rolling 7 days' },
            { label: 'Lifetime Revenue', value: formatINR(stats.revenue), note: 'All-time earnings' },
          ].map((stat, index) => (
            <div
              key={index}
              className="bg-white p-6 border border-brand-divider flex flex-col hover:border-brand-black/30 hover:shadow-sm transition-all duration-300"
            >
              <h3 className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary mb-3">{stat.label}</h3>
              <p className="text-3xl font-display text-brand-black">{stat.value}</p>
              <p className="text-xs text-brand-secondary mt-2">{stat.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Order Status Overview */}
      <section>
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-brand-secondary mb-4">Order Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-brand-divider border border-brand-divider">
          {[
            { label: 'Pending', value: stats.orderStatuses.pending },
            { label: 'Processing', value: stats.orderStatuses.processing },
            { label: 'Shipped', value: stats.orderStatuses.shipped },
            { label: 'Delivered', value: stats.orderStatuses.delivered },
            { label: 'Cancelled', value: stats.orderStatuses.cancelled },
          ].map((stat, index) => (
            <div key={index} className="bg-white p-6 flex flex-col items-center justify-center text-center hover:bg-brand-bg/50 transition-colors">
              <p className="text-3xl font-display text-brand-black">{stat.value}</p>
              <h3 className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary mt-2">{stat.label}</h3>
            </div>
          ))}
        </div>
      </section>

      {/* Operational Metrics */}
      <section>
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-brand-secondary mb-4">Operational Metrics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {[
            { label: 'Total Orders', value: stats.totalOrders.toString(), note: 'All-time orders' },
            { label: 'Pending Orders', value: stats.pendingOrders.toString(), note: 'Requires processing' },
            { label: 'Delivered Orders', value: stats.deliveredOrders.toString(), note: 'Successfully completed' },
            { label: 'Total Products', value: stats.totalProducts.toString(), note: 'Active in catalog' },
            { label: 'Active Prime Members', value: stats.activePrimeMembers.toString(), note: 'Current subscriptions' },
            { label: 'Wholesale Inquiries', value: stats.wholesaleInquiries.toString(), note: 'Awaiting reply' },
          ].map((stat, index) => (
            <div
              key={index}
              className="bg-white p-6 border border-brand-divider flex flex-col hover:border-brand-black/30 hover:shadow-sm transition-all duration-300"
            >
              <h3 className="text-[10px] uppercase tracking-widest font-bold text-brand-secondary mb-3">{stat.label}</h3>
              <p className="text-3xl font-display text-brand-black">{stat.value}</p>
              <p className="text-xs text-brand-secondary mt-2">{stat.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quick Actions Area */}
      <section>
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-brand-secondary mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-6">
          <Link to="/admin/products/new" className="p-5 sm:p-6 bg-white border border-brand-divider hover:border-brand-black hover:shadow-sm transition-all duration-300 group flex flex-col items-start gap-3 sm:gap-4">
            <Package size={20} className="text-brand-secondary group-hover:text-brand-black transition-colors" />
            <div>
              <h4 className="text-sm font-medium text-brand-black mb-1">Add Product</h4>
              <p className="text-xs text-brand-secondary hidden sm:block">Create new item</p>
            </div>
          </Link>
          <Link to="/admin/orders" className="p-5 sm:p-6 bg-white border border-brand-divider hover:border-brand-black hover:shadow-sm transition-all duration-300 group flex flex-col items-start gap-3 sm:gap-4">
            <ShoppingBag size={20} className="text-brand-secondary group-hover:text-brand-black transition-colors" />
            <div>
              <h4 className="text-sm font-medium text-brand-black mb-1">View Orders</h4>
              <p className="text-xs text-brand-secondary hidden sm:block">Process orders</p>
            </div>
          </Link>
          <Link to="/admin/content" className="p-5 sm:p-6 bg-white border border-brand-divider hover:border-brand-black hover:shadow-sm transition-all duration-300 group flex flex-col items-start gap-3 sm:gap-4">
            <FileText size={20} className="text-brand-secondary group-hover:text-brand-black transition-colors" />
            <div>
              <h4 className="text-sm font-medium text-brand-black mb-1">Edit Content</h4>
              <p className="text-xs text-brand-secondary hidden sm:block">Update homepage</p>
            </div>
          </Link>
          <Link to="/admin/prime-members" className="p-5 sm:p-6 bg-white border border-brand-divider hover:border-brand-black hover:shadow-sm transition-all duration-300 group flex flex-col items-start gap-3 sm:gap-4">
            <Users size={20} className="text-brand-secondary group-hover:text-brand-black transition-colors" />
            <div>
              <h4 className="text-sm font-medium text-brand-black mb-1">Prime Members</h4>
              <p className="text-xs text-brand-secondary hidden sm:block">Manage access</p>
            </div>
          </Link>
          <Link to="/admin/policies" className="p-5 sm:p-6 bg-white border border-brand-divider hover:border-brand-black hover:shadow-sm transition-all duration-300 group flex flex-col items-start gap-3 sm:gap-4">
            <Shield size={20} className="text-brand-secondary group-hover:text-brand-black transition-colors" />
            <div>
              <h4 className="text-sm font-medium text-brand-black mb-1">Edit Policies</h4>
              <p className="text-xs text-brand-secondary hidden sm:block">Update rules</p>
            </div>
          </Link>
          <Link to="/admin/media" className="p-5 sm:p-6 bg-white border border-brand-divider hover:border-brand-black hover:shadow-sm transition-all duration-300 group flex flex-col items-start gap-3 sm:gap-4">
            <ImageIcon size={20} className="text-brand-secondary group-hover:text-brand-black transition-colors" />
            <div>
              <h4 className="text-sm font-medium text-brand-black mb-1">Manage Media</h4>
              <p className="text-xs text-brand-secondary hidden sm:block">Organize assets</p>
            </div>
          </Link>
        </div>
      </section>

      {/* Recent Activity & Orders Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-brand-secondary">Recent Orders</h2>
            <Link to="/admin/orders" className="text-[10px] font-bold uppercase tracking-widest text-brand-black hover:text-brand-secondary transition-colors">View All</Link>
          </div>
          <div className="bg-white border border-brand-divider overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-brand-bg border-b border-brand-divider">
                    <th className="p-4 text-[10px] uppercase tracking-widest font-bold text-brand-secondary">Order ID</th>
                    <th className="p-4 text-[10px] uppercase tracking-widest font-bold text-brand-secondary">Customer</th>
                    <th className="p-4 text-[10px] uppercase tracking-widest font-bold text-brand-secondary">Date</th>
                    <th className="p-4 text-[10px] uppercase tracking-widest font-bold text-brand-secondary">Status</th>
                    <th className="p-4 text-[10px] uppercase tracking-widest font-bold text-brand-secondary text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-10 text-center text-brand-secondary font-sans text-sm">
                        No orders yet.
                      </td>
                    </tr>
                  ) : (
                    recentOrders.map((order, index) => (
                      <tr key={index} className="border-b border-brand-divider last:border-0 hover:bg-brand-bg/50 transition-colors">
                        <td className="p-4 font-mono text-sm text-brand-black">{order.id}</td>
                        <td className="p-4 text-sm text-brand-black">{order.userName || 'Guest'}</td>
                        <td className="p-4 text-sm text-brand-secondary">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-4">
                          <span className="inline-block px-2 py-1 text-[10px] uppercase tracking-widest font-bold border border-brand-divider text-brand-black bg-brand-bg">
                            {order.status}
                          </span>
                        </td>
                        <td className="p-4 font-medium text-sm text-brand-black text-right">{formatINR(order.totalAmount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-brand-secondary mb-4">Recent Activity</h2>
          <div className="bg-white border border-brand-divider p-6 flex flex-col">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex gap-4 border-b border-brand-divider last:border-0 py-4 first:pt-0 last:pb-0 group hover:bg-brand-bg/30 transition-colors -mx-2 px-2 rounded-sm">
                <div className="w-1.5 h-1.5 mt-2 rounded-full bg-brand-divider group-hover:bg-brand-black transition-colors shrink-0" />
                <div>
                  <p className="font-sans text-brand-black text-sm leading-snug">{activity.text}</p>
                  <p className="text-xs text-brand-secondary mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
