import React, { useState } from 'react';
import { Package, Truck, Clock, AlertCircle, CheckCircle2, Search, Filter, Bell, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function DispatchDashboardPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'pending' | 'shipped'>('pending');

  // Dummy Data for UI
  const pendingOrders = [
    { id: 'ORD-LX-1042', customer: 'Rahul Sharma', items: 2, status: 'Packing', type: 'Standard', time: '2 hrs ago' },
    { id: 'ORD-LX-1041', customer: 'Amit Singh', items: 1, status: 'Ready to Ship', type: 'Prime', time: '4 hrs ago' },
    { id: 'ORD-LX-1039', customer: 'Vikram Patel', items: 3, status: 'Pending Verification', type: 'Wholesale', time: '1 day ago' },
  ];

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-8">
      {/* Header Section (User Info & Notifications) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-display text-black tracking-wide">Dispatch Operations</h1>
          <p className="text-xs text-gray-500 font-sans mt-1">Manage packing, shipments, and logistics</p>
        </div>
        
        <div className="flex items-center gap-6">
          <button className="relative text-gray-400 hover:text-black transition-colors">
            <Bell size={20} />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-gray-50"></span>
          </button>
          <div className="h-8 w-px bg-gray-200"></div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden md:block">
              <p className="text-xs font-bold text-black">{user?.name || 'Dispatch Manager'}</p>
              <p className="text-[9px] uppercase tracking-widest text-brand-secondary">{user?.role || 'Dispatch Team'}</p>
            </div>
            <div className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm">
              <User size={18} className="text-gray-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-5 hover:border-black/20 transition-colors">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Pending Actions</p>
            <p className="text-2xl font-display text-black mt-1">14</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-5 hover:border-black/20 transition-colors">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <Package size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Ready for Courier</p>
            <p className="text-2xl font-display text-black mt-1">08</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-5 hover:border-black/20 transition-colors">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
            <Truck size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Shipped Today</p>
            <p className="text-2xl font-display text-black mt-1">24</p>
          </div>
        </div>
      </div>

      {/* Order Management Area */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 p-4 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
            <button 
              onClick={() => setActiveTab('pending')}
              className={`px-6 py-2 text-xs font-bold uppercase tracking-widest rounded-md transition-colors ${activeTab === 'pending' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black'}`}
            >
              Action Required
            </button>
            <button 
              onClick={() => setActiveTab('shipped')}
              className={`px-6 py-2 text-xs font-bold uppercase tracking-widest rounded-md transition-colors ${activeTab === 'shipped' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black'}`}
            >
              Dispatched
            </button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search order ID..." className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-black" />
            </div>
            <button className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
              <Filter size={18} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="p-4 md:p-6 text-[10px] uppercase tracking-widest text-gray-500 font-bold border-b border-gray-200">Order ID</th>
                <th className="p-4 md:p-6 text-[10px] uppercase tracking-widest text-gray-500 font-bold border-b border-gray-200">Customer</th>
                <th className="p-4 md:p-6 text-[10px] uppercase tracking-widest text-gray-500 font-bold border-b border-gray-200">Details</th>
                <th className="p-4 md:p-6 text-[10px] uppercase tracking-widest text-gray-500 font-bold border-b border-gray-200">Status</th>
                <th className="p-4 md:p-6 text-[10px] uppercase tracking-widest text-gray-500 font-bold border-b border-gray-200 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {activeTab === 'pending' && pendingOrders.map((order, i) => (
                <tr key={i} className="hover:bg-gray-50/50 border-b border-gray-100 last:border-0 transition-colors">
                  <td className="p-4 md:p-6 font-bold text-sm text-black">{order.id}</td>
                  <td className="p-4 md:p-6">
                    <p className="text-sm font-medium text-gray-900">{order.customer}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{order.time}</p>
                  </td>
                  <td className="p-4 md:p-6">
                    <p className="text-sm text-gray-600">{order.items} Items</p>
                    <span className="inline-block mt-1 text-[9px] uppercase tracking-wider font-bold text-brand-secondary bg-gray-100 px-2 py-0.5 rounded">
                      {order.type}
                    </span>
                  </td>
                  <td className="p-4 md:p-6">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${
                      order.status === 'Ready to Ship' ? 'bg-blue-50 text-blue-700' :
                      order.status === 'Packing' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {order.status === 'Ready to Ship' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                      {order.status}
                    </span>
                  </td>
                  <td className="p-4 md:p-6 text-right">
                    <button className="bg-black text-white px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-gray-900 transition-colors">
                      Process
                    </button>
                  </td>
                </tr>
              ))}
              {activeTab === 'shipped' && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-gray-500 text-sm">
                    No recently shipped orders today.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}