import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions, db } from '../../firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { ArrowLeft, Loader2, Plus, X } from 'lucide-react';
import type { DesignDoc, SampleDesignDoc } from '../../types/production';

export default function SamplePieceCreatePage() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [designId, setDesignId] = useState('');
  const [sampleDesignId, setSampleDesignId] = useState('');
  const [notes, setNotes] = useState('');

  const [designs, setDesigns] = useState<DesignDoc[]>([]);
  const [samples, setSamples] = useState<SampleDesignDoc[]>([]);

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

  const loadSamples = useCallback(async () => {
    try {
      const q = query(collection(db, 'sampleDesigns'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setSamples(snap.docs.map(d => d.data() as SampleDesignDoc));
    } catch (err) {
      console.error('Failed to load samples:', err);
    }
  }, []);

  useEffect(() => { loadDesigns(); loadSamples(); }, [loadDesigns, loadSamples]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!designId) return;
    setCreating(true);
    setToast(null);

    try {
      const fn = httpsCallable(functions, 'samplePieceCreate');
      const result = await fn({
        designId,
        sampleDesignId: sampleDesignId || undefined,
        notes: notes.trim() || undefined,
      });

      setToast({ type: 'success', message: `Sample piece created (ID: ${(result.data as any).id}).` });
      setTimeout(() => navigate('/production/sample-pieces'), 1200);
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Failed to create sample piece.' });
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-2xl">
      <button
        onClick={() => navigate('/production/sample-pieces')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-black transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        Back to Sample Pieces
      </button>

      <h1 className="text-2xl font-display text-black tracking-wide mb-8">New Sample Piece</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-6">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Catalogue Design *</label>
          <select
            required
            value={designId}
            onChange={e => setDesignId(e.target.value)}
            className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black/20 transition-all bg-white"
          >
            <option value="">Select an approved design…</option>
            {designs.map(d => (
              <option key={d.id} value={d.id}>{d.id} — {d.name}</option>
            ))}
          </select>
          <p className="text-[10px] text-gray-400 mt-1">Only Owner-approved (frozen) designs can have sample garments.</p>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Based on Sample Design (optional)</label>
          <select
            value={sampleDesignId}
            onChange={e => setSampleDesignId(e.target.value)}
            className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black/20 transition-all bg-white"
          >
            <option value="">None</option>
            {samples.map(s => (
              <option key={s.id} value={s.id}>{s.id} — {s.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            placeholder="Construction notes, material reference…"
            className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black/20 transition-all" />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => navigate('/production/sample-pieces')}
            className="px-5 py-2.5 text-sm text-gray-500 hover:text-black transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={creating || !designId}
            className="flex items-center gap-2 px-6 py-2.5 bg-black text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors">
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {creating ? 'Creating…' : 'Create Sample Piece'}
          </button>
        </div>
      </form>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-xl ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          <span className="text-sm">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 text-white/70 hover:text-white"><X size={16} /></button>
        </div>
      )}
    </div>
  );
}