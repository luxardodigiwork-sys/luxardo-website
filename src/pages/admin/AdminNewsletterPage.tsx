import React, { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, documentId, getDocs, limit, orderBy, query, startAfter, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { newsletterCsv, subscriberDate } from '../../utils/newsletterExport';

/** Recovered newsletter management; reads are paged and export covers the loaded rows only. */
export default function AdminNewsletterPage() {
  const [rows, setRows] = useState<Array<Record<string, any>>>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [more, setMore] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = async (reset = false) => {
    setBusy(true); setError('');
    try {
      const after = !reset && cursor ? [startAfter(cursor)] : [];
      const result = await getDocs(query(collection(db, 'newsletterSubscribers'), orderBy(documentId()), ...after, limit(100)));
      const next = result.docs.map(snap => ({ ...snap.data(), id: snap.id }));
      setRows(prev => reset ? next : [...prev, ...next]);
      setCursor(result.docs.at(-1) ?? null);
      setMore(result.size === 100);
    } catch { setError('Subscribers could not be loaded. Check your connection and try again.'); }
    finally { setBusy(false); }
  };
  useEffect(() => { void load(true); }, []);
  const remove = async (id: string) => {
    if (!window.confirm('Remove this newsletter subscriber?')) return;
    setBusy(true); setError('');
    try {
      await deleteDoc(doc(db, 'newsletterSubscribers', id));
      setRows(prev => prev.filter(row => row.id !== id));
    } catch { setError('The subscriber could not be removed. Please try again.'); }
    finally { setBusy(false); }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([newsletterCsv(rows)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = `Luxardo_Subscribers_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="space-y-6">
    <h1 className="text-3xl font-display">Newsletter subscribers</h1>
    <p className="text-sm text-brand-secondary">{rows.length} subscriber(s) loaded. Export includes these loaded subscribers. No emails are sent from this page.</p>
    <div className="flex flex-wrap gap-3">
      <button disabled={busy} onClick={() => void load(true)} className="btn-outline px-5 py-3">Refresh</button>
      <button disabled={busy || !rows.length} onClick={download} className="btn-primary px-5 py-3 disabled:opacity-50">Export loaded subscribers</button>
    </div>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {busy && <p role="status">Loading...</p>}
    <div className="overflow-x-auto border border-brand-divider bg-white">
      <table className="w-full text-left text-sm"><thead><tr className="border-b border-brand-divider"><th className="p-4">Email</th><th className="p-4">Subscribed</th><th className="p-4">Status</th><th className="p-4">Action</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id} className="border-b border-brand-divider">
          <td className="p-4">{row.email}</td><td className="p-4">{subscriberDate(row.createdAt ?? row.subscribedAt).slice(0, 10) || 'Unknown'}</td><td className="p-4">{row.status || 'subscribed'}</td>
          <td className="p-4"><button disabled={busy} onClick={() => void remove(row.id)} className="text-red-700 underline" aria-label={`Remove ${row.email}`}>Remove</button></td>
        </tr>)}</tbody>
      </table>
    </div>
    {!busy && !rows.length && !error && <p>No subscribers found.</p>}
    {more && <button disabled={busy} onClick={() => void load(false)} className="btn-outline px-5 py-3">Load more</button>}
  </div>;
}
