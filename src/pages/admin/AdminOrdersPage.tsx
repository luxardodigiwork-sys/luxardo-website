import React, { useState, useEffect, useMemo } from 'react';
import { formatINR } from '../../utils/currency';
import { storage } from '../../utils/localStorage';
import { Order } from '../../types';
import { ShoppingBag, Search, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = () => {
      const ordersData = storage.getOrders();
      setOrders(ordersData);
      setIsLoading(false);
    };

    fetchOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => 
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.userEmail.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [orders, searchTerm]);

  const handleStatusChange = (orderId: string, newStatus: Order['status']) => {
    const updatedOrders = orders.map(order => 
      order.id === orderId ? { ...order, status: newStatus } : order
    );
    storage.saveOrders(updatedOrders);
    setOrders(updatedOrders);
  };

  const getProductSummary = (items: Order['items']) => {
    if (!items || items.length === 0) return 'No items';
    if (items.length === 1) return items[0].name;
    return `${items[0].name} + ${items.length - 1} more`;
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-display uppercase tracking-tight">Order Management</h1>
        <p className="text-brand-secondary font-sans mt-1">Track and process customer purchases</p>
      </div>

      <div className="bg-white border border-brand-divider shadow-sm">
        <div className="p-6 border-b border-brand-divider">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-secondary" size={18} />
            <input
              type="text"
              placeholder="Search by Order ID, name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-brand-bg border border-brand-divider pl-12 pr-4 py-3 font-sans focus:outline-none focus:border-brand-black transition-colors"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left border-collapse">
            <thead>
              <tr className="bg-brand-bg/50 border-b border-brand-divider">
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-brand-secondary whitespace-nowrap">Order ID</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-brand-secondary whitespace-nowrap">Date</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-brand-secondary whitespace-nowrap">Customer</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-brand-secondary whitespace-nowrap">Product Summary</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-brand-secondary whitespace-nowrap">Total</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-brand-secondary whitespace-nowrap">Payment</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-brand-secondary whitespace-nowrap">Status</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-brand-secondary text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-divider">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-20 text-center">
                    <div className="inline-block w-8 h-8 border-4 border-brand-divider border-t-brand-black rounded-full animate-spin"></div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-20 text-center font-sans text-brand-secondary">
                    No orders found.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="font-mono text-sm text-brand-black">{order.id}</p>
                      {order.trackingId && (
                        <p className="text-[10px] font-mono text-brand-secondary mt-1">TRK: {order.trackingId}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-brand-secondary text-sm whitespace-nowrap">
                      {new Date(order.createdAt).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="font-medium text-brand-black">{order.userName}</p>
                        <p className="text-xs font-sans text-brand-secondary">{order.userEmail}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-brand-secondary max-w-[200px] truncate">
                      {getProductSummary(order.items)}
                    </td>
                    <td className="px-6 py-4 font-sans font-bold text-brand-black whitespace-nowrap">
                      {formatINR(order.totalAmount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] uppercase tracking-widest font-bold border ${
                        (order.paymentStatus || 'paid') === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        order.paymentStatus === 'failed' ? 'bg-red-50 text-red-700 border-red-200' :
                        order.paymentStatus === 'refunded' ? 'bg-gray-50 text-gray-700 border-gray-200' :
                        'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {order.paymentStatus || 'Paid'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={order.status}
                        onChange={(e) => handleStatusChange(order.id, e.target.value as Order['status'])}
                        disabled={order.status === 'cancelled'}
                        className={`text-xs font-medium px-3 py-1.5 min-w-[110px] rounded-full border focus:outline-none focus:ring-1 focus:ring-brand-black cursor-pointer transition-colors ${
                          order.status === 'delivered' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          order.status === 'processing' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          order.status === 'packed' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                          order.status === 'shipped' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          order.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                          'bg-gray-50 text-gray-700 border-gray-200'
                        } ${order.status === 'cancelled' ? 'opacity-75 cursor-not-allowed' : ''}`}
                      >
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="packed">Packed</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <Link 
                        to={`/admin/orders/${order.id}`} 
                        className="p-2 rounded-md text-brand-secondary hover:bg-gray-100 hover:text-brand-black transition-colors inline-block" 
                        title="View Details"
                      >
                        <Eye size={18} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
