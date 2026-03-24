import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Users, 
  Settings, 
  Shield, 
  UserPlus, 
  Edit3, 
  Trash2, 
  Power, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Truck, 
  Package, 
  Send, 
  CheckCircle, 
  RotateCcw, 
  Eye, 
  EyeOff,
  Save,
  AlertCircle,
  MoreVertical,
  ArrowLeft,
  BarChart3,
  Calendar,
  Clock,
  TrendingUp
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { storage } from '../../utils/localStorage';
import { DispatchUser, DispatchSettings, DispatchPermissions } from '../../types';

export default function DispatchManagementPage() {
  const [users, setUsers] = useState<DispatchUser[]>([]);
  const [settings, setSettings] = useState<DispatchSettings | null>(null);
  const [activeTab, setActiveTab] = useState<'access' | 'settings' | 'analytics'>('access');
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month' | 'year'>('today');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<DispatchUser | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Form State for User
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    password: '',
    role: 'Dispatcher',
    status: 'active' as 'active' | 'disabled',
    permissions: {
      canVerifyOrders: true,
      canMarkPacked: true,
      canMarkShipped: true,
      canMarkDelivered: true,
      canEditTrackingId: true,
      canViewCustomerAddress: true,
      canExportOrders: true
    } as DispatchPermissions
  });

  useEffect(() => {
    setUsers(storage.getDispatchUsers());
    setSettings(storage.getDispatchSettings());
  }, []);

  const stats = useMemo(() => {
    const orders = storage.getOrders();
    const today = new Date().toDateString();
    
    const handledToday = orders.filter(o => new Date(o.createdAt).toDateString() === today).length;
    const shippedToday = orders.filter(o => o.status === 'shipped' && o.dispatchDate && new Date(o.dispatchDate).toDateString() === today).length;
    const deliveredToday = orders.filter(o => o.status === 'delivered' && new Date(o.createdAt).toDateString() === today).length;
    const returnedToday = orders.filter(o => o.status === 'returned' && new Date(o.createdAt).toDateString() === today).length;

    return {
      totalUsers: users.length,
      activeUsers: users.filter(u => u.status === 'active').length,
      handledToday,
      shippedToday,
      deliveredToday,
      returnedToday
    };
  }, [users]);

  const analytics = useMemo(() => {
    const orders = storage.getOrders();
    const now = new Date();
    
    const filteredOrders = orders.filter(o => {
      const orderDate = new Date(o.createdAt);
      if (timeFilter === 'today') return orderDate.toDateString() === now.toDateString();
      if (timeFilter === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return orderDate >= weekAgo;
      }
      if (timeFilter === 'month') {
        return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
      }
      if (timeFilter === 'year') {
        return orderDate.getFullYear() === now.getFullYear();
      }
      return true;
    });

    const totalDispatched = filteredOrders.filter(o => ['shipped', 'delivered', 'returned', 'failed_delivery'].includes(o.status)).length;
    const delivered = filteredOrders.filter(o => o.status === 'delivered').length;
    const pendingDispatch = filteredOrders.filter(o => ['processing', 'packed', 'pending'].includes(o.status)).length;
    const returned = filteredOrders.filter(o => o.status === 'returned').length;
    const failedDelivery = filteredOrders.filter(o => o.status === 'failed_delivery').length;

    // Average turnaround (hours)
    const dispatchedOrders = filteredOrders.filter(o => o.dispatchDate);
    const totalTurnaround = dispatchedOrders.reduce((sum, o) => {
      const start = new Date(o.createdAt).getTime();
      const end = new Date(o.dispatchDate!).getTime();
      return sum + (end - start);
    }, 0);
    const avgTurnaround = dispatchedOrders.length > 0 
      ? (totalTurnaround / dispatchedOrders.length / (1000 * 60 * 60)).toFixed(1) 
      : '0';

    return {
      totalDispatched,
      delivered,
      pendingDispatch,
      returned,
      failedDelivery,
      avgTurnaround
    };
  }, [timeFilter]);

  const handleSaveUser = () => {
    if (!formData.fullName || !formData.username) {
      alert('Please fill in all required fields');
      return;
    }

    // Secure confirmation for password change if editing
    if (editingUser && formData.password) {
      if (!confirm('Are you sure you want to update the password for this user? This will take effect immediately.')) {
        return;
      }
    }

    let updatedUsers = [...users];
    if (editingUser) {
      updatedUsers = updatedUsers.map(u => u.id === editingUser.id ? {
        ...u,
        fullName: formData.fullName,
        username: formData.username,
        role: formData.role,
        status: formData.status,
        permissions: formData.permissions,
        ...(formData.password ? { password: formData.password } : {})
      } : u);
    } else {
      const newUser: DispatchUser = {
        id: `dispatch-${Date.now()}`,
        fullName: formData.fullName,
        username: formData.username,
        password: formData.password || 'Luxardo@123',
        role: formData.role,
        status: formData.status,
        permissions: formData.permissions,
        createdAt: new Date().toISOString()
      };
      updatedUsers.unshift(newUser);
    }

    storage.saveDispatchUsers(updatedUsers);
    setUsers(updatedUsers);
    setIsModalOpen(false);
    setEditingUser(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      fullName: '',
      username: '',
      password: '',
      role: 'Dispatcher',
      status: 'active',
      permissions: {
        canVerifyOrders: true,
        canMarkPacked: true,
        canMarkShipped: true,
        canMarkDelivered: true,
        canEditTrackingId: true,
        canViewCustomerAddress: true,
        canExportOrders: true
      }
    });
  };

  const handleDeleteUser = (id: string) => {
    if (confirm('Are you sure you want to delete this dispatch account?')) {
      const updatedUsers = users.filter(u => u.id !== id);
      storage.saveDispatchUsers(updatedUsers);
      setUsers(updatedUsers);
    }
  };

  const toggleUserStatus = (id: string) => {
    const user = users.find(u => u.id === id);
    if (!user) return;

    const action = user.status === 'active' ? 'disable' : 'enable';
    if (!confirm(`Are you sure you want to ${action} this dispatch account? ${action === 'disable' ? 'They will lose access to the portal immediately.' : ''}`)) {
      return;
    }

    const updatedUsers = users.map(u => u.id === id ? {
      ...u,
      status: u.status === 'active' ? 'disabled' : 'active' as 'active' | 'disabled'
    } : u);
    storage.saveDispatchUsers(updatedUsers);
    setUsers(updatedUsers);
  };

  const handleSaveSettings = () => {
    if (settings) {
      storage.saveDispatchSettings(settings);
      alert('Dispatch settings updated successfully');
    }
  };

  return (
    <div className="min-h-screen bg-white p-8">
      {/* Header */}
      <div className="flex justify-between items-end mb-12">
        <div>
          <Link to="/admin" className="flex items-center gap-2 text-gray-400 hover:text-black transition-colors mb-6 text-[10px] font-bold uppercase tracking-widest">
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
          <h1 className="text-4xl font-bold text-black mb-2 tracking-tight">Dispatch Management</h1>
          <p className="text-gray-500 font-medium">Configure access and workflow for the logistics team.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => {
              resetForm();
              setEditingUser(null);
              setIsModalOpen(true);
            }}
            className="px-6 py-3 bg-black text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-gray-900 transition-all flex items-center gap-2 shadow-lg shadow-black/10"
          >
            <UserPlus size={16} /> Create Dispatch User
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-12">
        {[
          { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-blue-600' },
          { label: 'Active Users', value: stats.activeUsers, icon: Shield, color: 'text-emerald-600' },
          { label: 'Handled Today', value: stats.handledToday, icon: Package, color: 'text-indigo-600' },
          { label: 'Shipped Today', value: stats.shippedToday, icon: Send, color: 'text-blue-500' },
          { label: 'Delivered Today', value: stats.deliveredToday, icon: CheckCircle, color: 'text-emerald-500' },
          { label: 'Returned Today', value: stats.returnedToday, icon: RotateCcw, color: 'text-red-500' },
        ].map((stat, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group"
          >
            <div className={`p-3 rounded-xl bg-gray-50 w-fit mb-4 group-hover:scale-110 transition-transform ${stat.color}`}>
              <stat.icon size={20} />
            </div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
            <p className="text-2xl font-bold text-black">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-8 border-b border-gray-100 mb-8">
        <button 
          onClick={() => setActiveTab('access')}
          className={`pb-4 text-xs font-bold uppercase tracking-widest transition-all relative ${
            activeTab === 'access' ? 'text-black' : 'text-gray-400 hover:text-black'
          }`}
        >
          Access Management
          {activeTab === 'access' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />}
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`pb-4 text-xs font-bold uppercase tracking-widest transition-all relative ${
            activeTab === 'settings' ? 'text-black' : 'text-gray-400 hover:text-black'
          }`}
        >
          Workflow Settings
          {activeTab === 'settings' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />}
        </button>
        <button 
          onClick={() => setActiveTab('analytics')}
          className={`pb-4 text-xs font-bold uppercase tracking-widest transition-all relative ${
            activeTab === 'analytics' ? 'text-black' : 'text-gray-400 hover:text-black'
          }`}
        >
          Dispatch Analytics
          {activeTab === 'analytics' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />}
        </button>
      </div>

      {activeTab === 'access' ? (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">User Details</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Role</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Permissions</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 font-bold">
                        {user.fullName.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-black">{user.fullName}</div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">@{user.username}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-6">
                    <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest bg-gray-100 px-2 py-1 rounded">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-6">
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {Object.entries(user.permissions).filter(([_, val]) => val).map(([key]) => (
                        <span key={key} className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter border border-gray-100 px-1.5 py-0.5 rounded">
                          {key.replace('can', '').replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-6">
                    <div className="flex items-center gap-2">
                      {user.status === 'active' ? (
                        <span className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-600 uppercase tracking-widest">
                          <CheckCircle2 size={12} /> Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                          <XCircle size={12} /> Disabled
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-6 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          setEditingUser(user);
                          setFormData({
                            fullName: user.fullName,
                            username: user.username,
                            password: '',
                            role: user.role,
                            status: user.status,
                            permissions: user.permissions
                          });
                          setIsModalOpen(true);
                        }}
                        className="p-2 text-gray-400 hover:text-black hover:bg-white rounded-lg border border-transparent hover:border-gray-100 transition-all"
                        title="Edit User"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button 
                        onClick={() => toggleUserStatus(user.id)}
                        className={`p-2 rounded-lg border border-transparent hover:border-gray-100 transition-all ${
                          user.status === 'active' ? 'text-gray-400 hover:text-amber-600' : 'text-emerald-600 hover:text-emerald-700'
                        }`}
                        title={user.status === 'active' ? 'Disable User' : 'Enable User'}
                      >
                        <Power size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteUser(user.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-white rounded-lg border border-transparent hover:border-gray-100 transition-all"
                        title="Delete User"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : activeTab === 'settings' ? (
        <div className="max-w-4xl space-y-8">
          <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm">
            <h3 className="text-lg font-bold text-black mb-6 flex items-center gap-2">
              <Settings size={20} /> Workflow Configuration
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Verification Workflow</label>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setSettings(s => s ? { ...s, verificationWorkflow: 'simple' } : null)}
                      className={`flex-1 p-4 rounded-xl border transition-all text-left ${
                        settings?.verificationWorkflow === 'simple' ? 'border-black bg-black text-white' : 'border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200'
                      }`}
                    >
                      <p className="text-xs font-bold mb-1">Simple</p>
                      <p className="text-[10px] opacity-70">One-click verification</p>
                    </button>
                    <button 
                      onClick={() => setSettings(s => s ? { ...s, verificationWorkflow: 'strict' } : null)}
                      className={`flex-1 p-4 rounded-xl border transition-all text-left ${
                        settings?.verificationWorkflow === 'strict' ? 'border-black bg-black text-white' : 'border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200'
                      }`}
                    >
                      <p className="text-xs font-bold mb-1">Strict</p>
                      <p className="text-[10px] opacity-70">Multi-step validation</p>
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {[
                    { key: 'courierFieldsVisible', label: 'Courier Fields Visibility', desc: 'Show courier name and dispatch date fields' },
                    { key: 'trackingIdRequired', label: 'Tracking ID Required', desc: 'Force tracking ID before marking as shipped' },
                    { key: 'dispatchNotesEnabled', label: 'Dispatch Notes', desc: 'Allow dispatchers to add notes to orders' }
                  ].map((toggle) => (
                    <div key={toggle.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div>
                        <p className="text-xs font-bold text-black">{toggle.label}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{toggle.desc}</p>
                      </div>
                      <button 
                        onClick={() => setSettings(s => s ? { ...s, [toggle.key]: !s[toggle.key as keyof DispatchSettings] } : null)}
                        className={`w-12 h-6 rounded-full transition-all relative ${
                          settings?.[toggle.key as keyof DispatchSettings] ? 'bg-black' : 'bg-gray-200'
                        }`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                          settings?.[toggle.key as keyof DispatchSettings] ? 'left-7' : 'left-1'
                        }`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Default Statuses</label>
                  <div className="space-y-2">
                    {['verified', 'packed', 'shipped', 'delivered', 'returned', 'failed_delivery'].map((status) => (
                      <div key={status} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <input 
                          type="checkbox"
                          checked={settings?.defaultStatuses.includes(status)}
                          onChange={(e) => {
                            if (!settings) return;
                            const newStatuses = e.target.checked 
                              ? [...settings.defaultStatuses, status]
                              : settings.defaultStatuses.filter(s => s !== status);
                            setSettings({ ...settings, defaultStatuses: newStatuses });
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
                        />
                        <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{status.replace('_', ' ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-12 pt-8 border-t border-gray-100 flex justify-end">
              <button 
                onClick={handleSaveSettings}
                className="px-8 py-3 bg-black text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-gray-900 transition-all flex items-center gap-2 shadow-lg shadow-black/10"
              >
                <Save size={16} /> Save Settings
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Time Filter */}
          <div className="flex items-center justify-between bg-gray-50 p-2 rounded-2xl border border-gray-100 w-fit">
            {(['today', 'week', 'month', 'year'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setTimeFilter(filter)}
                className={`px-6 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                  timeFilter === filter ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          {/* Analytics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { label: 'Total Dispatched', value: analytics.totalDispatched, icon: Truck, color: 'text-blue-600', desc: 'Orders that left the warehouse' },
              { label: 'Delivered Orders', value: analytics.delivered, icon: CheckCircle2, color: 'text-emerald-600', desc: 'Successfully received by customers' },
              { label: 'Pending Dispatch', value: analytics.pendingDispatch, icon: Clock, color: 'text-amber-600', desc: 'Orders awaiting shipment' },
              { label: 'Returned Orders', value: analytics.returned, icon: RotateCcw, color: 'text-red-600', desc: 'Orders sent back by customers' },
              { label: 'Failed Delivery', value: analytics.failedDelivery, icon: XCircle, color: 'text-gray-600', desc: 'Unsuccessful delivery attempts' },
              { label: 'Avg Turnaround', value: `${analytics.avgTurnaround}h`, icon: TrendingUp, color: 'text-indigo-600', desc: 'Time from order to dispatch' },
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className={`p-4 rounded-2xl bg-gray-50 ${item.color} group-hover:scale-110 transition-transform`}>
                    <item.icon size={24} />
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{item.label}</p>
                    <p className="text-3xl font-bold text-black">{item.value}</p>
                  </div>
                </div>
                <div className="pt-6 border-t border-gray-50">
                  <p className="text-xs text-gray-500 font-medium">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Performance Insight */}
          <div className="bg-black text-white p-8 rounded-3xl shadow-xl flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center">
                <BarChart3 size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-1 tracking-tight">Dispatch Efficiency</h3>
                <p className="text-gray-400 text-sm font-medium">Your team is maintaining an average turnaround of {analytics.avgTurnaround} hours this {timeFilter}.</p>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className={`w-1.5 rounded-full bg-white/20 ${i <= 4 ? 'h-8' : 'h-12'}`} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <div>
                <h2 className="text-2xl font-bold text-black">{editingUser ? 'Edit Dispatch User' : 'Create Dispatch User'}</h2>
                <p className="text-gray-400 text-xs font-medium mt-1">Set up access and permissions for the logistics team.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <XCircle size={24} className="text-gray-400" />
              </button>
            </div>

            <div className="p-8 overflow-y-auto space-y-8">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Full Name</label>
                  <input 
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="e.g. Arjun Singh"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:border-black transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Username / Dispatch ID</label>
                  <input 
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="e.g. arjun_dispatch"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-mono focus:outline-none focus:border-black transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Password</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder={editingUser ? 'Leave blank to keep current' : 'Enter password'}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:border-black transition-all pr-12"
                    />
                    <button 
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Role / Label</label>
                  <input 
                    type="text"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    placeholder="e.g. Senior Dispatcher"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:border-black transition-all"
                  />
                </div>
              </div>

              {/* Permissions */}
              <div className="space-y-4">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Permissions & Access</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'canVerifyOrders', label: 'Can Verify Orders' },
                    { key: 'canMarkPacked', label: 'Can Mark Packed' },
                    { key: 'canMarkShipped', label: 'Can Mark Shipped' },
                    { key: 'canMarkDelivered', label: 'Can Mark Delivered' },
                    { key: 'canEditTrackingId', label: 'Can Edit Tracking ID' },
                    { key: 'canViewCustomerAddress', label: 'Can View Customer Address' },
                    { key: 'canExportOrders', label: 'Can Export Orders' }
                  ].map((perm) => (
                    <div 
                      key={perm.key}
                      onClick={() => setFormData({
                        ...formData,
                        permissions: {
                          ...formData.permissions,
                          [perm.key]: !formData.permissions[perm.key as keyof DispatchPermissions]
                        }
                      })}
                      className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                        formData.permissions[perm.key as keyof DispatchPermissions] 
                          ? 'border-black bg-black/5' 
                          : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                      }`}
                    >
                      <span className="text-[11px] font-bold text-gray-700 uppercase tracking-tight">{perm.label}</span>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        formData.permissions[perm.key as keyof DispatchPermissions] 
                          ? 'bg-black border-black text-white' 
                          : 'bg-white border-gray-200'
                      }`}>
                        {formData.permissions[perm.key as keyof DispatchPermissions] && <CheckCircle2 size={12} />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-8 bg-gray-50 border-t border-gray-100 flex gap-4">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-4 bg-white border border-gray-200 text-gray-600 font-bold text-xs uppercase tracking-widest rounded-xl hover:border-black hover:text-black transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveUser}
                className="flex-1 py-4 bg-black text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-gray-900 transition-all shadow-lg shadow-black/10"
              >
                {editingUser ? 'Update User' : 'Create User'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
