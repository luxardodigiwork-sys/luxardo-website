import React, { useState, useEffect, useCallback } from 'react';
import { db, functions } from '../../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Truck, Loader2, ArrowRight, Package, UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { can } from '../../utils/rolePermissions';

type Tailor = { uid: string; name: string };

const REQUEST_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-600',
  APPROVED: 'bg-emerald-50 text-emerald-600',
  REJECTED: 'bg-red-50 text-red-500',
};

export default function DispatchWorkspacePage() {
  const { user } = useAuth();
  const effectiveRole = (user?.staffRole || '') as any;
  const canAssign = can(effectiveRole, 'production.dispatch.assignTailor');
  const canSendToStore = can(effectiveRole, 'production.dispatch.sendToStore');
  const canRaiseTailorRequest = can(effectiveRole, 'production.tailorRequests.raise');

  const [readyPieces, setReadyPieces] = useState<any[]>([]);
  const [stitchedPieces, setStitchedPieces] = useState<any[]>([]);
  const [tailors, setTailors] = useState<Tailor[]>([]);
  const [selectedTailor, setSelectedTailor] = useState<Record<string, string>>({});
  const [tailorRequests, setTailorRequests] = useState<any[]>([]);
  const [reqName, setReqName] = useState('');
  const [reqEmail, setReqEmail] = useState('');
  const [reqReason, setReqReason] = useState('');
  const [reqSubmitting, setReqSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [readySnap, stitchedSnap] = await Promise.all([
        getDocs(query(collection(db, 'pieces'), where('stage', '==', 'DISPATCH_READY'))),
        getDocs(query(collection(db, 'pieces'), where('stage', '==', 'STITCH_COMPLETE'))),
      ]);
      setReadyPieces(readySnap.docs.map((d) => d.data()));
      setStitchedPieces(stitchedSnap.docs.map((d) => d.data()));

      if (canAssign) {
        const res: any = await httpsCallable(functions, 'listActiveTailors')({});
        setTailors(res?.data?.tailors || []);
      }

      if (canRaiseTailorRequest) {
        const reqSnap = await getDocs(query(collection(db, 'tailorRequests'), where('requestedByUid', '==', user?.id || '')));
        const reqs = reqSnap.docs.map((d) => d.data());
        reqs.sort((a, b) => String(b.requestedAt).localeCompare(String(a.requestedAt)));
        setTailorRequests(reqs);
      }
    } catch (err: any) {
      console.error('Failed to load Dispatch workspace:', err);
      setError(err?.message || 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, [canAssign, canRaiseTailorRequest, user?.id]);

  useEffect(() => { load(); }, [load]);

  const submitTailorRequest = async () => {
    if (!reqName.trim() || !reqEmail.trim() || !reqReason.trim()) return;
    setReqSubmitting(true);
    setError(null);
    try {
      await httpsCallable(functions, 'raiseNewTailorRequest')({
        name: reqName.trim(), email: reqEmail.trim(), reason: reqReason.trim(),
      });
      setReqName(''); setReqEmail(''); setReqReason('');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to raise Tailor request.');
    } finally {
      setReqSubmitting(false);
    }
  };

  const assignTailor = async (pieceId: string) => {
    const tailorUid = selectedTailor[pieceId];
    if (!tailorUid) return;
    setBusyId(pieceId);
    setError(null);
    try {
      await httpsCallable(functions, 'dispatchAssignTailor')({ pieceId, tailorUid });
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to assign Tailor.');
    } finally {
      setBusyId(null);
    }
  };

  const sendToStore = async (pieceId: string) => {
    setBusyId(pieceId);
    setError(null);
    try {
      await httpsCallable(functions, 'dispatchSendToStore')({ pieceId });
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to send to Store.');
    } finally {
      setBusyId(null);
    }
  };

  if (!canAssign && !canSendToStore && !canRaiseTailorRequest) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-gray-500">You do not have permission to access the Dispatch workspace.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center">
            <Truck size={18} />
          </div>
          <div>
            <h1 className="text-2xl font-display text-black tracking-wide">Dispatch Workspace</h1>
            <p className="text-xs text-gray-500 font-sans mt-1">
              {readyPieces.length} ready for routing · {stitchedPieces.length} ready for Store{loading && ' · loading…'}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 text-red-600 text-xs">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* DISPATCH_READY — assign a Tailor, or skip straight to Store */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-black uppercase tracking-widest">Ready for Routing</h2>
            </div>
            {readyPieces.length === 0 ? (
              <div className="text-center py-12">
                <Package size={28} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">No pieces are currently DISPATCH_READY.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {readyPieces.map((piece) => (
                  <div key={piece.id} className="p-4 md:px-6 flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <span className="font-mono text-xs font-medium text-black">{piece.id}</span>
                      <span className="ml-3 text-xs text-gray-400 font-mono">{piece.prId || '—'}</span>
                    </div>
                    {canAssign && (
                      <div className="flex items-center gap-2">
                        <select
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 min-w-[140px]"
                          value={selectedTailor[piece.id] || ''}
                          onChange={(e) => setSelectedTailor((s) => ({ ...s, [piece.id]: e.target.value }))}
                        >
                          <option value="">Select Tailor…</option>
                          {tailors.map((t) => (
                            <option key={t.uid} value={t.uid}>{t.name || t.uid}</option>
                          ))}
                        </select>
                        <button
                          disabled={!selectedTailor[piece.id] || busyId === piece.id}
                          onClick={() => assignTailor(piece.id)}
                          className="px-3 py-1.5 bg-black text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:opacity-80 transition-opacity disabled:opacity-30"
                        >
                          Assign
                        </button>
                      </div>
                    )}
                    {canSendToStore && (
                      <button
                        disabled={busyId === piece.id}
                        onClick={() => sendToStore(piece.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-700 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-gray-50 transition-colors disabled:opacity-30"
                      >
                        Send to Store (skip)
                        <ArrowRight size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* STITCH_COMPLETE — send finished pieces to Store */}
          {canSendToStore && (
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-sm font-bold text-black uppercase tracking-widest">Stitching Complete — Send to Store</h2>
              </div>
              {stitchedPieces.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-gray-500">No stitched pieces waiting to enter Store.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {stitchedPieces.map((piece) => (
                    <div key={piece.id} className="p-4 md:px-6 flex items-center justify-between gap-3">
                      <div>
                        <span className="font-mono text-xs font-medium text-black">{piece.id}</span>
                        <span className="ml-3 text-xs text-gray-400 font-mono">{piece.prId || '—'}</span>
                      </div>
                      <button
                        disabled={busyId === piece.id}
                        onClick={() => sendToStore(piece.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:opacity-80 transition-opacity disabled:opacity-30"
                      >
                        Send to Store
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* New Tailor Request */}
          {canRaiseTailorRequest && (
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <UserPlus size={16} className="text-gray-400" />
                <h2 className="text-sm font-bold text-black uppercase tracking-widest">Request New Tailor</h2>
              </div>
              <div className="p-6 flex flex-col md:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Tailor Name"
                  className="text-xs border border-gray-200 rounded-lg px-3 py-2 flex-1"
                  value={reqName}
                  onChange={(e) => setReqName(e.target.value)}
                />
                <input
                  type="email"
                  placeholder="Email"
                  className="text-xs border border-gray-200 rounded-lg px-3 py-2 flex-1"
                  value={reqEmail}
                  onChange={(e) => setReqEmail(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Reason"
                  className="text-xs border border-gray-200 rounded-lg px-3 py-2 flex-1"
                  value={reqReason}
                  onChange={(e) => setReqReason(e.target.value)}
                />
                <button
                  disabled={reqSubmitting || !reqName.trim() || !reqEmail.trim() || !reqReason.trim()}
                  onClick={submitTailorRequest}
                  className="px-4 py-2 bg-black text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:opacity-80 transition-opacity disabled:opacity-30 whitespace-nowrap"
                >
                  Submit Request
                </button>
              </div>
              {tailorRequests.length > 0 && (
                <div className="divide-y divide-gray-100 border-t border-gray-100">
                  {tailorRequests.map((r) => (
                    <div key={r.id} className="px-6 py-3 flex items-center justify-between gap-3">
                      <div className="text-xs text-gray-600">
                        <span className="font-medium text-black">{r.name}</span>
                        <span className="ml-2 text-gray-400">{r.email}</span>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-md ${REQUEST_STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-500'}`}>
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
