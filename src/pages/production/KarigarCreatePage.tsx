import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import { ArrowLeft, Loader2, Plus, X } from 'lucide-react';
import { PRODUCTION_CONFIG } from '../../constants/businessConfig';

export default function KarigarCreatePage() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [skillTags, setSkillTags] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [hourlyRate, setHourlyRate] = useState<number>(100);
  const [badgeId, setBadgeId] = useState('');
  const [notes, setNotes] = useState('');

  const addSkill = () => {
    const tag = skillInput.trim();
    if (tag && !skillTags.includes(tag)) {
      setSkillTags([...skillTags, tag]);
      setSkillInput('');
    }
  };

  const removeSkill = (tag: string) => {
    setSkillTags(skillTags.filter(t => t !== tag));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !mobile.trim() || skillTags.length === 0) return;
    setCreating(true);
    setToast(null);

    try {
      const karigarCreateFn = httpsCallable(functions, 'karigarCreate');
      const result = await karigarCreateFn({
        name: name.trim(),
        mobile: mobile.trim(),
        skillTags,
        hourlyRate,
        badgeId: badgeId.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      setToast({ type: 'success', message: `Karigar "${name.trim()}" created (ID: ${(result.data as any).id}).` });
      setTimeout(() => navigate('/production/karigars'), 1200);
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Failed to create karigar.' });
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-2xl">
      <button
        onClick={() => navigate('/production/karigars')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-black transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        Back to Karigars
      </button>

      <h1 className="text-2xl font-display text-black tracking-wide mb-8">Add Karigar</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-6">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Full Name *</label>
          <input type="text" required value={name} onChange={e => setName(e.target.value)}
            className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black/20 transition-all" />
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Mobile Number *</label>
          <input type="tel" required value={mobile} onChange={e => setMobile(e.target.value)} placeholder="91XXXXXXXXXX"
            className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black/20 transition-all" />
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Skill Tags *</label>
          <div className="flex gap-2">
            <input type="text" value={skillInput} onChange={e => setSkillInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
              placeholder="e.g. stitching, embroidery, cutting"
              className="flex-1 px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black/20 transition-all" />
            <button type="button" onClick={addSkill}
              className="px-4 py-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors">
              <Plus size={16} />
            </button>
          </div>
          {skillTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {skillTags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black text-white text-xs font-medium rounded-lg">
                  {tag}
                  <button type="button" onClick={() => removeSkill(tag)} className="text-white/60 hover:text-white">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
            Hourly Rate (₹/hr) *
          </label>
          <input type="number" required min={PRODUCTION_CONFIG.defaultHourlyRateRange.min} max={PRODUCTION_CONFIG.defaultHourlyRateRange.max}
            value={hourlyRate} onChange={e => setHourlyRate(Number(e.target.value))}
            className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black/20 transition-all" />
          <p className="text-[10px] text-gray-400 mt-1">
            Range: ₹{PRODUCTION_CONFIG.defaultHourlyRateRange.min}–₹{PRODUCTION_CONFIG.defaultHourlyRateRange.max}/hr
          </p>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Badge ID (optional)</label>
          <input type="text" value={badgeId} onChange={e => setBadgeId(e.target.value)}
            className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black/20 transition-all" />
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black/20 transition-all" />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => navigate('/production/karigars')}
            className="px-5 py-2.5 text-sm text-gray-500 hover:text-black transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={creating || skillTags.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-black text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors">
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {creating ? 'Creating…' : 'Create Karigar'}
          </button>
        </div>
      </form>

      {/* Toast */}
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
