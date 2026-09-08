import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { doc, getDoc, collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { ArrowLeft, Loader2, Package, Clock, User, RefreshCw, AlertCircle, ChevronRight, X, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { can } from '../../utils/rolePermissions';
import { functions } from '../../firebase';
import { httpsCallable } from 'firebase/functions';

const STAGE_COLORS: Record<string, string> = {
  OPEN: 'bg-gray-100 text-gray-600',
  IN_WORK: 'bg-blue-50 text-blue-600',
  QC_PENDING: 'bg-amber-50 text-amber-600',
  REWORK: 'bg-orange-50 text-orange-600',
  QC_PASS: 'bg-emerald-50 text-emerald-600',
  DISPATCH_READY: 'bg-emerald-50 text-emerald-700',
  TAILOR_ASSIGNED: 'bg-indigo-50 text-indigo-600',
  STITCHING: 'bg-indigo-50 text-indigo-700',
  STITCH_COMPLETE: 'bg-violet-50 text-violet-600',
  STORE: 'bg-teal-50 text-teal-600',
  STORE_OUT: 'bg-teal-50 text-teal-700',
  REJECTED: 'bg-red-50 text-red-500',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-600',
  in_rework: 'bg-orange-50 text-orange-600',
  closed: 'bg-gray-100 text-gray-500',
  replaced: 'bg-purple-50 text-purple-600',
};

interface MovementDoc {
  id: string;
  pieceId: string;
  fromStage: string | null;
  toStage: string;
  direction: string;
  action: string;
  at: string;
  actorUid: string;
  actorName: string;
  actorRole: string;
  reason: string | null;
  relatedRequestId: string | null;
  relatedPieceId: string | null;
}

export default function PieceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [piece, setPiece] = useState<any>(null);
  const [pr, setPr] = useState<any>(null);
  const [design, setDesign] = useState<any>(null);
  const [version, setVersion] = useState<any>(null);
  const [movements, setMovements] = useState<MovementDoc[]>([]);
  const [karigars, setKarigars] = useState<any[]>([]);
  const [selectedKarigar, setSelectedKarigar] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);

  const effectiveRole = (user?.staffRole || user?.role || '') as any;
  const canAssignKarigar = can(effectiveRole, 'production.pieces.assignKarigar');

  const callFn = async (fnName: string, data: Record<string, unknown>) => {
    try {
      await httpsCallable(functions, fnName)(data);
      return true;
    } catch (err: any) {
      console.error(`${fnName} failed:`, err);
      setNotice(err?.message || 'Action failed. Please try again.');
      return false;
    }
  };

  const refreshKarigars = useCallback(async () => {
    if (!canAssignKarigar) return;
    try {
      const q = query(
        collection(db, 'karigars'),
        where('active', '==', true),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      setKarigars(snap.docs.map(d => d.data()));
    } catch (err) {
      console.error('Failed to load karigars:', err);
    }
  }, [canAssignKarigar]);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const snap = await getDoc(doc(db, 'pieces', id));
      if (!snap.exists()) { setLoading(false); return; }
      const p = snap.data();
      setPiece(p);
      refreshKarigars();

      // Parallel-serial: resolve related docs
      const promises: Promise<void>[] = [];

      if (p.prId) {
        promises.push(
          getDoc(doc(db, 'productionRequests', p.prId))
            .then(s => { if (s.exists()) setPr(s.data()); })
            .catch(() => {})
        );
      }
      if (p.designId) {
        promises.push(
          getDoc(doc(db, 'catalogueDesigns', p.designId))
            .then(s => { if (s.exists()) setDesign(s.data()); })
            .catch(() => {})
        );
      }
      if (p.designVersionId) {
        promises.push(
          getDoc(doc(db, 'designVersions', p.designVersionId))
            .then(s => { if (s.exists()) setVersion(s.data()); })
            .catch(() => {})
        );
      }
      await Promise.all(promises);

      // Movement history
      try {
        const mq = query(
          collection(db, 'pieceMovementHistory'),
          where('pieceId', '==', id),
          orderBy('at', 'desc')
        );
        const msnap = await getDocs(mq);
        setMovements(msnap.docs.map(d => d.data() as MovementDoc));
      } catch (err) {
        console.error('Failed to load movement history:', err);
      }
    } catch (err) {
      console.error('Failed to load piece:', err);
    } finally {
      setLoading(false);
    }
  }, [id, refreshKarigars]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!piece) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-gray-500">Piece not found.</p>
        <button onClick={() => navigate('/production/pieces')} className="mt-4 text-sm text-black underline">
          Back to Pieces
        </button>
      </div>
    );
  }

  const isClosed = piece.status === 'closed' || piece.status === 'replaced';

  const handleAssign = async () => {
    if (!selectedKarigar || busy) return;
    setBusy(true);
    setNotice('');
    const ok = await callFn('pieceAssignKarigar', { pieceId: piece.id, karigarId: selectedKarigar });
    if (ok) {
      setSelectedKarigar('');
      await load();
    }
    setBusy(false);
  };

  const handleRemove = async (karigarId: string) => {
    if (busy) return;
    setBusy(true);
    setNotice('');
    const ok = await callFn('pieceRemoveKarigar', { pieceId: piece.id, karigarId });
    if (ok) await load();
    setBusy(false);
  };

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-5xl">
      <button
        onClick={() => navigate('/production/pieces')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-black transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        Back to Pieces
      </button>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center">
            <Package size={24} className="text-gray-400" />
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-display text-black tracking-wide font-mono">{piece.id}</h1>
              <span className={`inline-flex items-center px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest rounded-md ${STAGE_COLORS[piece.stage] || 'bg-gray-100 text-gray-500'}`}>
                {piece.stage || 'OPEN'}
              </span>
              <span className={`inline-flex items-center px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest rounded-md ${STATUS_COLORS[piece.status] || 'bg-gray-100 text-gray-500'}`}>
                {piece.status || 'active'}
              </span>
            </div>
            <p className="text-xs text-gray-500 font-mono mt-1">
              {piece.kind || 'PHYSICAL'} · Created {new Date(piece.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Replacement callouts */}
      {piece.replacesPieceId && (
        <div className="flex items-center gap-2 px-4 py-3 bg-purple-50 border border-purple-100 rounded-xl text-sm text-purple-700 mb-6">
          <RefreshCw size={14} />
          Replaces rejected piece
          <button onClick={() => navigate(`/production/pieces/${piece.replacesPieceId}`)} className="underline font-mono text-xs ml-1">{piece.replacesPieceId}</button>
        </div>
      )}
      {piece.replacedByPieceId && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700 mb-6">
          <AlertCircle size={14} />
          Rejected and replaced by
          <button onClick={() => navigate(`/production/pieces/${piece.replacedByPieceId}`)} className="underline font-mono text-xs ml-1">{piece.replacedByPieceId}</button>
        </div>
      )}

      {/* Relationship card */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 mb-6">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Design & Request Relationship</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Production Request</p>
            {pr ? (
              <button
                onClick={() => navigate(`/production/requests/${piece.prId}`)}
                className="text-sm font-medium text-black underline font-mono hover:text-gray-600 transition-colors"
              >
                {piece.prId}
                <span className="ml-2 text-gray-500 normal-case tracking-normal">({pr.status})</span>
              </button>
            ) : (
              <p className="text-sm text-gray-400 font-mono">{piece.prId || '—'}</p>
            )}
          </div>
          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Catalogue Design</p>
            {design ? (
              <button
                onClick={() => navigate(`/production/designs/${piece.designId}`)}
                className="text-sm font-medium text-black underline hover:text-gray-600 transition-colors"
              >
                {design.catalogueShortName || design.name}
                <span className="ml-2 font-mono text-xs text-gray-500 normal-case tracking-normal">({piece.designId})</span>
              </button>
            ) : (
              <p className="text-sm text-gray-400 font-mono">{piece.designId || '—'}</p>
            )}
          </div>
          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Design Version</p>
            {version ? (
              <p className="text-sm text-black">
                v{version.versionNo}
                <span className="ml-2 text-xs text-gray-500">{version.changeNote || ''}</span>
              </p>
            ) : (
              <p className="text-sm text-gray-400 font-mono">{piece.designVersionId || '—'}</p>
            )}
          </div>
        </div>
      </div>

      {/* Piece attributes */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 mb-6">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Piece Details</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Labour (min)</p>
            <p className="text-2xl font-display text-black mt-1">{piece.totalLabourMinutes || 0}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Labour Cost</p>
            <p className="text-2xl font-display text-black mt-1">₹{(piece.totalLabourCost || 0).toFixed(2)}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Reworks</p>
            <p className="text-2xl font-display text-black mt-1">{piece.reworkCount || 0}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Created By</p>
            <p className="text-sm font-medium text-black mt-1">{piece.createdByName || '—'}</p>
            <p className="text-[10px] text-gray-400 font-mono">{piece.createdBy || ''}</p>
          </div>
        </div>
        {piece.firstWorkAt && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-gray-400" />
              First work: {new Date(piece.firstWorkAt).toLocaleString()}
            </div>
            {piece.lastWorkAt && (
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-gray-400" />
                Last work: {new Date(piece.lastWorkAt).toLocaleString()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Assigned karigars */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Assigned Karigars</h2>
          {canAssignKarigar && (
            <button
              onClick={handleAssign}
              disabled={busy || !selectedKarigar}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:opacity-80 transition-opacity disabled:opacity-40"
            >
              <Users size={12} />
              Assign
            </button>
          )}
        </div>

        {Array.isArray(piece.assignedKarigars) && piece.assignedKarigars.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {piece.assignedKarigars.map((kid: string) => (
              <span key={kid} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg text-xs font-mono text-gray-700">
                <User size={12} className="text-gray-400" />
                {karigars.find(k => k.id === kid)?.name || kid}
                {canAssignKarigar && (
                  <button
                    onClick={() => handleRemove(kid)}
                    disabled={busy}
                    className="ml-1 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
                    title="Remove karigar"
                  >
                    <X size={12} />
                  </button>
                )}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No karigars assigned to this piece yet.</p>
        )}

        {/* Assign karigar selector (active registry only) */}
        {canAssignKarigar && karigars.length > 0 && (
          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <select
              value={selectedKarigar}
              onChange={e => { setSelectedKarigar(e.target.value); setNotice(''); }}
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black/20 transition-all"
            >
              <option value="">Select karigar to assign…</option>
              {karigars
                .filter(k => !(Array.isArray(piece.assignedKarigars) && piece.assignedKarigars.includes(k.id)))
                .map(k => (
                  <option key={k.id} value={k.id}>{k.name} · {k.id}</option>
                ))}
            </select>
            <button
              onClick={handleAssign}
              disabled={busy || !selectedKarigar}
              className="px-4 py-2 bg-black text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:opacity-80 transition-opacity disabled:opacity-40"
            >
              Assign Karigar
            </button>
          </div>
        )}
        {canAssignKarigar && karigars.length === 0 && (
          <p className="mt-3 text-xs text-gray-400">No active karigars in the registry to assign.</p>
        )}
        {notice && <p className="mt-3 text-xs text-red-500">{notice}</p>}
      </div>

      {/* Rejection / rework info */}
      {(piece.rejectionReason || piece.rejectionType) && (
        <div className={`border rounded-2xl shadow-sm p-6 mb-6 ${
          piece.rejectionType === 'COMPLETE_REJECT' ? 'bg-red-50 border-red-100' : 'bg-orange-50 border-orange-100'
        }`}>
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
            {piece.rejectionType === 'COMPLETE_REJECT' ? 'Rejection (Complete)' : 'Rework'}
          </h2>
          <div className="space-y-1 text-sm">
            {piece.rejectionType && (
              <p className="font-mono text-xs text-gray-600">Type: {piece.rejectionType}</p>
            )}
            {piece.rejectionReason && (
              <p className="text-gray-700">{piece.rejectionReason}</p>
            )}
            {piece.rejectedByName && (
              <p className="text-xs text-gray-500 mt-1">
                By {piece.rejectedByName} · {piece.rejectedAt ? new Date(piece.rejectedAt).toLocaleString() : ''}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Notes */}
      {piece.notes && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 mb-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Notes</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{piece.notes}</p>
        </div>
      )}

      {/* Movement history timeline */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Movement History</h2>
        {movements.length === 0 ? (
          <p className="text-sm text-gray-400">No movements recorded yet.</p>
        ) : (
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />
            <div className="space-y-4">
              {movements.map((m, i) => (
                <div key={m.id || i} className="relative pl-10">
                  <div className={`absolute left-3 top-1 w-3 h-3 rounded-full border-2 ${
                    m.direction === 'REVERSE'
                      ? 'bg-red-100 border-red-300'
                      : 'bg-emerald-100 border-emerald-300'
                  }`} />
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-black uppercase tracking-wider">{m.action}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${
                        m.direction === 'REVERSE' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {m.direction}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 font-mono">
                      {m.fromStage || '—'} → {m.toStage}
                    </p>
                    {m.reason && (
                      <p className="text-xs text-gray-500 mt-1 italic">{m.reason}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400">
                      <span>{m.actorName || m.actorUid}</span>
                      <span>·</span>
                      <span>{new Date(m.at).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      {m.relatedRequestId && (
                        <button
                          onClick={() => navigate(`/production/requests/${m.relatedRequestId}`)}
                          className="text-[10px] font-mono text-gray-400 hover:text-black underline transition-colors"
                        >
                          {m.relatedRequestId}
                        </button>
                      )}
                      {m.relatedPieceId && (
                        <button
                          onClick={() => navigate(`/production/pieces/${m.relatedPieceId}`)}
                          className="text-[10px] font-mono text-gray-400 hover:text-black underline transition-colors"
                        >
                          {m.relatedPieceId}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
