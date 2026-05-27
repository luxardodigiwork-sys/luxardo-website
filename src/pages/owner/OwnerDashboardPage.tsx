  import React from 'react';
import { TrendingUp, Users, ShoppingBag, Globe, Bell, User, ArrowUpRight, DollarSign } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function OwnerDashboardPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-display text-black tracking-wide">Executive Overview</h1>
          <p className="text-xs text-gray-500 font-sans mt-1">High-level analytics and business performance</p>
        </div>
        
        <div className="flex items-center gap-6">
          <button className="relative text-gray-400 hover:text-black transition-colors">
            <Bell size={20} />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-gray-50"></span>
          </button>
          <div className="h-8 w-px bg-gray-200"></div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden md:block">
              <p className="text-xs font-bold text-black">{user?.name || 'Kan Singh'}</p>
              <p className="text-[9px] uppercase tracking-widest text-brand-secondary">Director / Owner</p>
            </div>
            <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center shadow-sm">
              <User size={18} className="text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Primary KPI Cards (Black styling for Owner premium feel) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-black text-white p-6 rounded-2xl shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-full -mr-8 -mt-8 pointer-events-none"></div>
          <div className="flex items-center gap-3 mb-4 text-white/70">
            <DollarSign size={18} />
            <h3 className="text-[10px] font-bold uppercase tracking-widest">Monthly Revenue</h3>
          </div>
          <p className="text-3xl font-display mb-2">₹ 24,50,000</p>
          <div className="flex items-center gap-2 text-emerald-400 text-xs">
            <TrendingUp size={14} />
            <span>+14.5% vs last month</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4 text-gray-500">
            <ShoppingBag size={18} />
            <h3 className="text-[10px] font-bold uppercase tracking-widest">Total Orders (MTD)</h3>
          </div>
          <p className="text-3xl font-display text-black mb-2">482</p>
          <div className="flex items-center gap-2 text-emerald-600 text-xs">
            <TrendingUp size={14} />
            <span>+5.2% vs last month</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4 text-gray-500">
            <Users size={18} />
            <h3 className="text-[10px] font-bold uppercase tracking-widest">Prime Members</h3>
          </div>
          <p className="text-3xl font-display text-black mb-2">124</p>
          <div className="flex items-center gap-2 text-emerald-600 text-xs">
            <TrendingUp size={14} />
            <span>+12 new this week</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4 text-gray-500">
            <Globe size={18} />
            <h3 className="text-[10px] font-bold uppercase tracking-widest">B2B Inquiries</h3>
          </div>
          <p className="text-3xl font-display text-black mb-2">18</p>
          <div className="flex items-center gap-2 text-amber-600 text-xs">
            <AlertCircle size={14} />
            <span>5 pending review</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Wholesale Inquiries */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-sm uppercase tracking-widest text-black">New Partnership Requests</h3>
            <button className="text-xs text-gray-500 hover:text-black flex items-center gap-1">View All <ArrowUpRight size={14}/></button>
          </div>
          <div className="space-y-4">
            {[
              { name: 'Royal Boutique', location: 'Mumbai, India', type: 'Multi-Brand', status: 'Reviewing' },
              { name: 'Sartorial Elegance', location: 'London, UK', type: 'Independent', status: 'New' },
              { name: 'Elite Threads', location: 'Delhi, India', type: 'Department', status: 'New' }
            ].map((req, i) => (
              <div key={i} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                <div>
                  <h4 className="font-bold text-sm text-black">{req.name}</h4>
                  <p className="text-xs text-gray-500 mt-1">{req.location} • {req.type}</p>
                </div>
                <span className={`px-3 py-1 rounded text-[9px] font-bold uppercase tracking-widest ${req.status === 'New' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                  {req.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Performing Collections */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-sm uppercase tracking-widest text-black">Top Collections (MTD)</h3>
          </div>
          <div className="space-y-4">
            {[
              { name: 'The ERA Collection', revenue: '₹ 8,40,000', sales: 120, trend: '+12%' },
              { name: 'The NOQ Series', revenue: '₹ 5,20,000', sales: 85, trend: '+8%' },
              { name: 'Heritage Classic', revenue: '₹ 3,90,000', sales: 64, trend: '-2%' }
            ].map((col, i) => (
              <div key={i} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="text-lg font-display text-gray-300">0{i+1}</div>
                  <div>
                    <h4 className="font-bold text-sm text-black">{col.name}</h4>
                    <p className="text-xs text-gray-500 mt-1">{col.sales} Sales</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm text-black">{col.revenue}</p>
                  <p className={`text-[10px] font-bold ${col.trend.startsWith('+') ? 'text-emerald-500' : 'text-red-500'} mt-1`}>
                    {col.trend}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
    </div>
  );
}