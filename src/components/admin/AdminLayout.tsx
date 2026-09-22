import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingBag, Package, FileText, Shield, LogOut, Layers, Crown, Image as ImageIcon, Send, Truck, Settings, Users, BarChart3, Wallet, Menu, X, Mail, Newspaper, Hammer } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import AdminAssistantChatbot from './AdminAssistantChatbot';
import { AnimatePresence, motion } from 'framer-motion';

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  const navGroups = [
    {
      title: 'Store',
      items: [
        { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/admin/products', label: 'Products', icon: Package },
        { path: '/admin/collections', label: 'Collections', icon: Layers },
      ]
    },
    {
      title: 'Content',
      items: [
        { path: '/admin/media', label: 'Media', icon: ImageIcon },
        { path: '/admin/content', label: 'Site Content', icon: FileText },
        { path: '/admin/prime-content', label: 'Prime Content', icon: Crown },
        { path: '/admin/policies', label: 'Policies', icon: Shield },
      ]
    },
    {
      title: 'Customers',
      items: [
        { path: '/admin/prime-members', label: 'Prime Members', icon: Users },
        { path: '/admin/bespoke-requests', label: 'Bespoke Requests', icon: Send },
        { path: '/admin/partners', label: 'Partners', icon: Wallet },
        { path: '/admin/contact-messages', label: 'Contact Messages', icon: Mail },
        { path: '/admin/newsletter', label: 'Newsletter', icon: Newspaper },
      ]
    },
    {
      title: 'System',
      items: [
        { path: '/admin/backend-management', label: 'Staff & Roles', icon: Shield },
        { path: '/admin/settings', label: 'Settings', icon: Settings },
      ]
    },
    {
      title: 'Loom',
      items: [
        { path: '/production', label: 'Production', icon: Hammer },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans text-black selection:bg-black selection:text-white">
      <AdminAssistantChatbot />

      {/* --- DESKTOP SIDEBAR --- */}
      <aside className="w-64 bg-white border-r border-gray-200 flex-col hidden md:flex h-screen sticky top-0 z-20">
        <div className="p-8 border-b border-gray-100 flex flex-col justify-center min-h-[100px]">
          <h1 className="font-display text-xl tracking-[0.2em] uppercase text-black">LUXARDO FASHION</h1>
          <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-2 font-bold">Admin Portal</p>
        </div>
        
        <nav className="flex-1 px-4 py-8 space-y-8 overflow-y-auto no-scrollbar">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-3">
              <h3 className="text-[9px] uppercase tracking-[0.2em] font-bold text-gray-400 px-4 select-none">
                {group.title}
              </h3>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = location.pathname.startsWith(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-all duration-200 rounded-lg group ${
                        isActive 
                          ? 'bg-black text-white font-medium shadow-sm' 
                          : 'text-gray-500 hover:bg-gray-50 hover:text-black'
                      }`}
                    >
                      <item.icon size={16} className={`${isActive ? 'text-white' : 'text-gray-400 group-hover:text-black'} transition-colors`} />
                      <span className="tracking-wide">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100 bg-white">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 text-sm text-gray-500 hover:bg-gray-50 hover:text-black w-full text-left transition-all duration-200 rounded-lg group"
          >
            <LogOut size={16} className="text-gray-400 group-hover:text-black transition-colors" />
            <span className="tracking-wide">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* --- MOBILE SIDEBAR OVERLAY --- */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-[280px] bg-white border-r border-gray-200 flex flex-col z-50 md:hidden shadow-2xl"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white">
                <div>
                  <h1 className="font-display text-lg tracking-[0.2em] uppercase text-black">LUXARDO</h1>
                  <p className="text-[9px] text-gray-400 uppercase tracking-widest mt-1 font-bold">Admin Portal</p>
                </div>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)} 
                  className="p-2 -mr-2 text-gray-400 hover:text-black hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <nav className="flex-1 px-4 py-6 space-y-8 overflow-y-auto no-scrollbar">
                {navGroups.map((group) => (
                  <div key={group.title} className="space-y-2">
                    <h3 className="text-[9px] uppercase tracking-[0.2em] font-bold text-gray-400 px-4">{group.title}</h3>
                    <div className="space-y-1">
                      {group.items.map((item) => {
                        const isActive = location.pathname.startsWith(item.path);
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={`flex items-center gap-3 px-4 py-3 text-sm transition-all duration-200 rounded-lg ${
                              isActive 
                                ? 'bg-black text-white font-medium' 
                                : 'text-gray-500 hover:bg-gray-50 hover:text-black'
                            }`}
                          >
                            <item.icon size={18} className={isActive ? 'text-white' : 'text-gray-400'} />
                            <span className="tracking-wide">{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>

              <div className="p-4 border-t border-gray-100 bg-white">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-4 py-3 text-sm text-gray-500 hover:bg-gray-50 hover:text-black w-full text-left transition-all duration-200 rounded-lg"
                >
                  <LogOut size={18} className="text-gray-400" />
                  <span className="tracking-wide">Sign Out</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* --- MAIN CONTENT WRAPPER --- */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden bg-gray-50/50">
        
        {/* Mobile Header */}
        <header className="md:hidden bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 h-16 flex justify-between items-center sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMobileMenuOpen(true)} 
              className="p-2 -ml-2 text-black hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Menu size={20} />
            </button>
            <h1 className="font-display text-sm tracking-[0.2em] uppercase text-black">LUXARDO</h1>
          </div>
          <button 
            onClick={handleLogout} 
            className="p-2 -mr-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-colors"
          >
            <LogOut size={18} />
          </button>
        </header>

        {/* Content Outlet */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 lg:p-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}