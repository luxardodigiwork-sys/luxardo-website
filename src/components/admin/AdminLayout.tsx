import React from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingBag, Package, FileText, Shield, LogOut, Layers, Crown, Image as ImageIcon, Send, Truck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  const navItems = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/orders', label: 'Orders', icon: ShoppingBag },
    { path: '/admin/products', label: 'Products', icon: Package },
    { path: '/admin/collections', label: 'Collections', icon: Layers },
    { path: '/admin/prime-members', label: 'Prime Members', icon: Crown },
    { path: '/admin/content', label: 'Content', icon: FileText },
    { path: '/admin/media', label: 'Media', icon: ImageIcon },
    { path: '/admin/policies', label: 'Policies', icon: Shield },
    { path: '/admin/dispatch-management', label: 'Dispatch', icon: Truck },
  ];

  return (
    <div className="min-h-screen bg-brand-bg flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-brand-divider flex flex-col hidden md:flex">
        <div className="p-6 border-b border-brand-divider">
          <h1 className="font-display text-2xl tracking-widest uppercase">Luxardo</h1>
          <p className="text-xs text-brand-secondary uppercase tracking-widest mt-1">Admin Panel</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                  isActive 
                    ? 'bg-brand-black text-white' 
                    : 'text-brand-secondary hover:bg-brand-bg hover:text-brand-black'
                }`}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-brand-divider">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 text-sm text-brand-secondary hover:text-brand-black w-full text-left transition-colors"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden bg-white border-b border-brand-divider p-4 flex justify-between items-center">
          <h1 className="font-display text-xl tracking-widest uppercase">Luxardo Admin</h1>
          <button onClick={handleLogout} className="text-brand-secondary">
            <LogOut size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-auto p-6 md:p-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
