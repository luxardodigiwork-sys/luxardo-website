import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions, db } from '../../firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { ArrowLeft, Loader2, Plus, X } from 'lucide-react';
import type { DesignDoc, DesignVersionDoc } from '../../types/production';

export default function ProductionRequestCreatePage() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [designId, setDesignId] = useState('');
  const [designVersionId, setDesignVersionId] = useState('');
  const [quantity, setQuantity] = useState<number>(0);
  const [urgency, setUrgency] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('MEDIUM');
  const [requiredDate, setRequiredDate] = useState('');
  const [garmentType, setGarmentType] = useState('');

  const [designs, setDesigns] = useState<DesignDoc[]>([]);
  const [versions, setVersions] = useState<DesignVersionDoc[]>([]);

  const loadDesigns = useCallback(async () => {
    try {
      const q = query(
        collection(db, 'catalogueDesigns'),
        where('isFrozen', '==', true),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      setDesigns(snap.docs.map(d => d.data() as DesignDoc));
    } catch (err) {
      console.error('Failed to load designs:', err);
    }
  }, []);

  // Load version list for the selected design
  useEffect(() => {
    if (!designId) { setVersions([]); return; }
    const loadVersions = async () => {
      try {
        const q = query(
          collection(db, 'designVersions'),
          where('designId', '==', designId),
          orderBy('versionNo', 'desc')
        );
        const snap = await getDocs(q);
        setVersions(snap.docs.map(v => v.data() as DesignVersionDoc));
      } catch (err) {
        console.error('Failed to load versions:', err);
        setVersions([]);
      }
    };
    loadVersions();
  }, [designId]);

  useEffect(() => { loadDesigns(); }, [loadDesigns]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!designId || !designVersionId) return;
    setCreating(true);
    setToast(null);

    try {
      const fn = httpsCallable(functions, 'prCreate');
      const result = await fn({
        designId,
        designVersionId,
        quantity: quantity || 0,
        urgency,
        requiredDate: requiredDate || undefined,
        garmentType: garmentType.trim() || undefined,
      });

      const prId = (result.data as any).id;
      setToast({
        type: 'success',
        message: `Production request ${prId} created${quantity > 0 ? '' : ' with quantity 0 (submit the PR first to set quantity above 0)'}.`,
      });
      setTimeout(() => navigate(`/production/requests/${prId}`), 1500);
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Failed to create production request.' });
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-2xl">
      <button
        onClick={() => navigate('/production/requests')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-black transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        Back to Production Requests
      </button>

      <h1 className="text-2xl font-display text-black tracking-wide mb-8">New Production Request</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-6">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Catalogue Design *</label>
          <select
            required
            value={designId}
            onChange={e => { setDesignId(e.target.value); setDesignVersionId(''); }}
            className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black/20 transition-all bg-white"
          >
            <option value="">Select an approved design…</option>
            {designs.map(d => (
              <option key={d.id} value={d.id}>{d.id} — {d.name} (v{d.currentVersion})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Design Version *</label>
          <select
            required
            value={designVersionId}
            onChange={e => setDesignVersionId(e.target.value)}
            disabled={!designId}
            className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black/20 transition-all bg-white disabled:bg-gray-50"
          >
            <option value="">{designId ? 'Select version…' : 'Select a design first'}</option>
            {versions.map(v => (
              <option key={v.id} value={v.id}>{v.id} — v{v.versionNo}</option>
            ))}
          </select>
          <p className="text-[10px] text-gray-400 mt-1">Only Owner-approved (frozen) versions can be produced.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Quantity</label>
            <input
              type="number"
              min={0}
              value={quantity}
              onChange={e => setQuantity(Math.max(0, Number(e.target.value)))}
              className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black/20 transition-all"
            />
            <p className="text-[10px] text-amber-500 mt-1">Defaults to 0. PR cannot be submitted at quantity 0.</p>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Urgency</label>
            <select
              value={urgency}
              onChange={e => setUrgency(e.target.value as 'HIGH' | 'MEDIUM' | 'LOW')}
              className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black/20 transition-all bg-white"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Required By (YYYY-MM-DD)</label>
            <input
              type="date"
              value={requiredDate}
              onChange={e => setRequiredDate(e.target.value)}
              className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black/20 transition-all"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Garment Type (optional)</label>
            <input
              type="text"
              value={garmentType}
              onChange={e => setGarmentType(e.target.value)}
              placeholder="e.g. Kurti, Saree, Dupatta"
              className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black/20 transition-all"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => navigate('/production/requests')}
            className="px-5 py-2.5 text-sm text-gray-500 hover:text-black transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={creating || !designId || !designVersionId}
            className="flex items-center gap-2 px-6 py-2.5 bg-black text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors">
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {creating ? 'Creating…' : 'Create Request'}
          </button>
        </div>
      </form>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-xl ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          <span className="text-sm">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 text-white/70 hover:text-white">×</button>
        </div>
      )}
    </div>
  );
}