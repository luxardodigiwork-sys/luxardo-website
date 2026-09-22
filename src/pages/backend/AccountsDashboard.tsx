import React, { useState } from 'react';
import { CreditCard, CheckCircle2, AlertCircle, Search, Filter, Bell, User, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function AccountsDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'verification' | 'ledgers'>('verification');

  // B2B Wholesale Pending Payments Dummy Data
  const pendingVerifications = [
    { id: 'ORD-LX-1039', party: 'Regal Textile (Mahesh Sharma)', amount: '₹ 3,45,000', method: 'NEFT/Bank Transfer', utr: 'UTR983742421AA', date: 'Today' },
    { id: 'ORD-LX-1035', party: 'Shiv Kripa Garments', amount: '₹ 1,85,000', method: 'RTGS Transfer', utr: 'RTGS00293122', date: 'Yesterday' },
  ];

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-8">
      {/* Top Header Bar (User Profile & Notifications) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-display text-black tracking-wide">Financial Accounts</h1>
          <p className="text-xs text-gray-500 font-sans mt-1">Verify B2B bank transfers, clear invoices, and release order holds</p>
        </div>
        
        <div className="flex items-center gap-6">
          <button className="relative text-gray-400 hover:text-black transition-colors" title="Important Notifications">
            <Bell size={20} />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-gray-50"></span>
          </button>
          <div className="h-8 w-px bg-gray-200"></div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden md:block">
              <p className="text-xs font-bold text-black">{user?.name || 'Accounts Manager'}</p>
              <p className="text-[9px] uppercase tracking-widest text-brand-secondary">{user?.role || 'Finance Desk'}</p>
            </div>
            <div className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm">
              <User size={18} className="text-gray-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Financial KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-5">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
            <AlertCircle size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Awaiting UTR Verification</p>
            <p className="text-2xl font-display text-black mt-1">₹ 5,30,000</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-5">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
            <ShieldCheck size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Cleared & Unlocked Today</p>
            <p className="text-2xl font-display text-black mt-1">₹ 14,20,000</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-5">
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center shrink-0">
            <CreditCard size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total Outstanding Credit</p>
            <p className="text-2xl font-display text-black mt-1">₹ 8,90,000</p>
          </div>
        </div>
      </div>

      {/* Main Ledger Content Wrapper */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 p-4 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
            <button 
              onClick={() => setActiveTab('verification')}
              className={`px-6 py-2 text-xs font-bold uppercase tracking-widest rounded-md transition-colors ${activeTab === 'verification' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black'}`}
            >
              UTR Verification Flow
            </button>
            <button 
              onClick={() => setActiveTab('ledgers')}
              className={`px-6 py-2 text-xs font-bold uppercase tracking-widest rounded-md transition-colors ${activeTab === 'ledgers' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black'}`}
            >
              Party Credit Ledgers
            </button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search Party or Invoice..." className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-black" />
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
                <th className="p-4 md:p-6 text-[10px] uppercase tracking-widest text-gray-500 font-bold border-b border-gray-200">Invoice / Order ID</th>
                <th className="p-4 md:p-6 text-[10px] uppercase tracking-widest text-gray-500 font-bold border-b border-gray-200">B2B Retail Partner</th>
                <th className="p-4 md:p-6 text-[10px] uppercase tracking-widest text-gray-500 font-bold border-b border-gray-200">Payment Reference</th>
                <th className="p-4 md:p-6 text-[10px] uppercase tracking-widest text-gray-500 font-bold border-b border-gray-200">Amount</th>
                <th className="p-4 md:p-6 text-[10px] uppercase tracking-widest text-gray-500 font-bold border-b border-gray-200 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {activeTab === 'verification' && pendingVerifications.map((item, i) => (
                <tr key={i} className="hover:bg-gray-50/50 border-b border-gray-100 last:border-0 transition-colors">
                  <td className="p-4 md:p-6 font-bold text-sm text-black">{item.id}</td>
                  <td className="p-4 md:p-6">
                    <p className="text-sm font-medium text-gray-900">{item.party}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Logged: {item.date}</p>
                  </td>
                  <td className="p-4 md:p-6">
                    <p className="text-sm text-gray-700 font-mono font-bold">{item.utr}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.method}</p>
                  </td>
                  <td className="p-4 md:p-6">
                    <p className="text-sm font-bold text-gray-900">{item.amount}</p>
                    <span className="inline-block text-[9px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded mt-1">Holds Release</span>
                  </td>
                  <td className="p-4 md:p-6 text-right">
                    <button className="bg-black text-white px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-gray-900 transition-all shadow-sm flex items-center gap-1.5 ml-auto">
                      <CheckCircle2 size={14} /> Unlock Order
                    </button>
                  </td>
                </tr>
              ))}
              {activeTab === 'ledgers' && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-gray-500 text-sm font-sans">
                    All B2B credit limits are under healthy operational margins. No warning flags.
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