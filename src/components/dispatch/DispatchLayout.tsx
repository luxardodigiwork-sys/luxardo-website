import React from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Truck, LogOut, Package, Box, Send, CheckCircle2 } from 'lucide-react';

export default function DispatchLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('luxardo_dispatch_auth');
    localStorage.removeItem('luxardo_dispatch_user');
    navigate('/dispatch/login');
  };

  const navItems = [
    { path: '/dispatch/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Header */}
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="bg-black text-white p-1.5">
            <Truck size={20} />
          </div>
          <h1 className="font-bold text-lg tracking-tight uppercase">Luxardo Dispatch</h1>
        </div>
        
        <div className="flex items-center gap-6">
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-4 py-2 text-sm font-medium transition-colors rounded-md ${
                    isActive 
                      ? 'bg-gray-100 text-black' 
                      : 'text-gray-500 hover:text-black hover:bg-gray-50'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          
          <div className="h-6 w-px bg-gray-200" />
          
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-red-600 transition-colors"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-8 max-w-[1600px] mx-auto w-full">
        <Outlet />
      </main>
      
      {/* Footer Status */}
      <footer className="bg-white border-t border-gray-200 py-3 px-6 flex justify-between items-center text-[10px] text-gray-400 uppercase tracking-widest font-bold">
        <div>Luxardo Dispatch Portal v1.0</div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-green-500" /> System Online</span>
          <span>{new Date().toLocaleDateString()}</span>
        </div>
      </footer>
    </div>
  );
}
