import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Shield, Truck, Receipt, BarChart3, Lock, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

type Portal = {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  loginPath: string;
};

const PORTALS: Portal[] = [
  {
    id: 'owner',
    title: 'Owner',
    description: 'Full business oversight, revenue analytics, and strategic controls.',
    icon: Shield,
    color: 'bg-black',
    loginPath: '/owner/login',
  },
  {
    id: 'dispatch',
    title: 'Dispatch',
    description: 'Order verification, packing, courier tracking, and delivery flow.',
    icon: Truck,
    color: 'bg-zinc-900',
    loginPath: '/dispatch/login',
  },
  {
    id: 'accounts',
    title: 'Accounts',
    description: 'Payments, invoices, GST, financial reporting and reconciliation.',
    icon: Receipt,
    color: 'bg-zinc-800',
    loginPath: '/accounts/login',
  },
  {
    id: 'analysis',
    title: 'Analytics',
    description: 'Business insights, conversion data, and operational metrics.',
    icon: BarChart3,
    color: 'bg-zinc-700',
    loginPath: '/accounts/login',
  },
];

export default function BackendGatewayPage() {
  const navigate = useNavigate();
  const { user, isAuthReady } = useAuth();

  // If already signed in with a recognised staff role, route them straight to their dashboard.
  useEffect(() => {
    if (!isAuthReady || !user) return;
    const role = (user.role || '').toLowerCase();
    if (['admin', 'super_admin'].includes(role)) {
      navigate('/admin/dashboard', { replace: true });
    } else if (role === 'owner') {
      navigate('/owner/dashboard', { replace: true });
    } else if (role === 'dispatch') {
      navigate('/dispatch/dashboard', { replace: true });
    } else if (role === 'accounts' || role === 'analysis') {
      navigate('/analysis/dashboard', { replace: true });
    }
  }, [user, isAuthReady, navigate]);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 md:px-12 py-12">
      <div className="w-full max-w-6xl">
        <Link to="/" className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-black mb-10">
          <ArrowLeft size={14} /> Back to main site
        </Link>

        <div className="text-center mb-14">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-black text-white rounded-2xl mb-6 shadow-md">
            <Lock size={22} />
          </div>
          <h1 className="text-3xl md:text-5xl font-display tracking-tight text-black uppercase mb-3">
            LUXARDO FASHION Backend
          </h1>
          <p className="text-gray-500 max-w-md mx-auto text-sm md:text-base">
            Select your role to access the corresponding secure portal.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {PORTALS.map((portal, idx) => (
            <motion.div
              key={portal.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: idx * 0.08 }}
            >
              <Link
                to={portal.loginPath}
                className="group block h-full bg-white border border-gray-100 p-8 rounded-2xl shadow-sm hover:shadow-xl hover:border-black transition-all duration-500"
              >
                <div className={`w-12 h-12 ${portal.color} text-white rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500`}>
                  <portal.icon size={22} />
                </div>
                <h3 className="text-lg font-bold text-black mb-3 uppercase tracking-tight">{portal.title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed mb-6 min-h-[60px]">{portal.description}</p>
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-black group-hover:gap-4 transition-all duration-300">
                  <span>Access Portal</span>
                  <ArrowRight size={12} />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Master admin separate link, less prominent */}
        <div className="text-center mt-12">
          <Link
            to="/admin/login"
            className="text-[10px] uppercase tracking-[0.3em] text-gray-400 hover:text-black border-b border-gray-300 hover:border-black pb-1 transition-colors"
          >
            Master Admin Sign-In →
          </Link>
        </div>

        <div className="mt-16 flex justify-center gap-6 text-[10px] font-bold uppercase tracking-widest text-gray-300">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> System Online
          </span>
          <span className="flex items-center gap-1.5">
            <Lock size={10} /> Encrypted Access
          </span>
        </div>
      </div>
    </div>
  );
}
