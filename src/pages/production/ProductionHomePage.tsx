import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { roleLabel, can } from '../../utils/rolePermissions';
import { Layers, Users, Package, FileText, TrendingUp, Palette, Scissors, Shirt, ClipboardList } from 'lucide-react';

export default function ProductionHomePage() {
  const { user } = useAuth();
  const staffRole = user?.staffRole || user?.role || '';
  const effectiveRole = staffRole || user?.role || '';

  return (
    <div className="min-h-screen p-6 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-display text-black tracking-wide">Production Dashboard</h1>
        <p className="text-xs text-gray-500 font-sans mt-1">
          {roleLabel(staffRole)} · Loom Production Overview
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-black text-white p-6 rounded-2xl shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-full -mr-8 -mt-8 pointer-events-none" />
          <div className="flex items-center gap-3 mb-4 text-white/70">
            <Layers size={18} />
            <h3 className="text-[10px] font-bold uppercase tracking-widest">Active Designs</h3>
          </div>
          <p className="text-3xl font-display mb-2">—</p>
          <p className="text-[10px] text-white/50 uppercase tracking-widest">Coming soon</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4 text-gray-500">
            <Package size={18} />
            <h3 className="text-[10px] font-bold uppercase tracking-widest">Pieces In-Production</h3>
          </div>
          <p className="text-3xl font-display text-black mb-2">—</p>
          <p className="text-[10px] text-gray-400 uppercase tracking-widest">Coming soon</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4 text-gray-500">
            <Users size={18} />
            <h3 className="text-[10px] font-bold uppercase tracking-widest">Karigars</h3>
          </div>
          <p className="text-3xl font-display text-black mb-2">—</p>
          <p className="text-[10px] text-gray-400 uppercase tracking-widest">Coming soon</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4 text-gray-500">
            <FileText size={18} />
            <h3 className="text-[10px] font-bold uppercase tracking-widest">Open Requests</h3>
          </div>
          <p className="text-3xl font-display text-black mb-2">—</p>
          <p className="text-[10px] text-gray-400 uppercase tracking-widest">Coming soon</p>
        </div>
      </div>

      {/* Role-specific quick links */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
        <h3 className="font-bold text-sm uppercase tracking-widest text-black mb-4">Quick Links</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <a
            href="/production/staff"
            className="flex items-center gap-3 p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <Users size={18} className="text-gray-400" />
            <div>
              <p className="text-sm font-medium text-black">Staff Management</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">Create & manage staff roles</p>
            </div>
          </a>
          <a
            href="/production/karigars"
            className="flex items-center gap-3 p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <Users size={18} className="text-gray-400" />
            <div>
              <p className="text-sm font-medium text-black">Karigar Registry</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">Labour & skill database</p>
            </div>
          </a>
          <a
            href="/admin/dashboard"
            className="flex items-center gap-3 p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <TrendingUp size={18} className="text-gray-400" />
            <div>
              <p className="text-sm font-medium text-black">Admin Portal</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">E-commerce admin dashboard</p>
            </div>
          </a>
        </div>
      </div>

      {/* Design Chain quick links */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 mt-6">
        <h3 className="font-bold text-sm uppercase tracking-widest text-black mb-4">Design → Production Request</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {can(effectiveRole as any, 'production.designs') && (
            <a
              href="/production/designs"
              className="flex items-center gap-3 p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <Palette size={18} className="text-gray-400" />
              <div>
                <p className="text-sm font-medium text-black">Catalogue Designs</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest">KL-XXXX · versions</p>
              </div>
            </a>
          )}
          {can(effectiveRole as any, 'production.sampleDesigns') && (
            <a
              href="/production/sample-designs"
              className="flex items-center gap-3 p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <Scissors size={18} className="text-gray-400" />
              <div>
                <p className="text-sm font-medium text-black">Sample Designs</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest">fabric swatches</p>
              </div>
            </a>
          )}
          {can(effectiveRole as any, 'production.samplePieces') && (
            <a
              href="/production/sample-pieces"
              className="flex items-center gap-3 p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <Shirt size={18} className="text-gray-400" />
              <div>
                <p className="text-sm font-medium text-black">Sample Pieces</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest">catalogue garments</p>
              </div>
            </a>
          )}
          {can(effectiveRole as any, 'production.requests') && (
            <a
              href="/production/requests"
              className="flex items-center gap-3 p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <ClipboardList size={18} className="text-gray-400" />
              <div>
                <p className="text-sm font-medium text-black">Production Requests</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest">PR-XXXX · approvals</p>
              </div>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
