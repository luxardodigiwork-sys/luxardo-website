import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import { useAuth } from '../../context/AuthContext';

type RoleChoice = 'admin' | 'owner' | 'dispatch' | 'none';

const ROLE_HELP: Record<RoleChoice, string> = {
  admin: 'Full control of the website: products, content, orders (fulfilment), policies and staff roles.',
  owner: 'Owner view: sales, orders and customers for decision making. Read-only.',
  dispatch: 'Dispatch: receive paid orders, pack, enter courier/tracking, mark shipped and delivered.',
  none: 'Remove staff access (the person becomes a normal customer).',
};

/** Give or remove a staff role. Calls the admin-only setStaffRoleFn (roles are Firebase custom claims). */
export default function AdminStaffPage() {
  const { staffRole } = useAuth();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<RoleChoice>('dispatch');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await httpsCallable(functions, 'setStaffRoleFn')({ email: email.trim(), role });
      setMsg({ ok: true, text: role === 'none' ? 'Staff access removed.' : `Done. ${email.trim()} is now ${role}. Ask them to sign out and sign in again.` });
      setEmail('');
    } catch (err: any) {
      setMsg({ ok: false, text: err?.message ? String(err.message) : 'Could not change the role. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  if (staffRole !== 'admin') return <p className="p-8 text-sm text-gray-500">Admins only.</p>;

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-2xl mb-2">Staff &amp; Roles</h1>
      <p className="text-sm text-gray-500 mb-6">
        The person must sign in once at <span className="font-mono">/backend/login</span> with Google (so their email is verified) before you can give them a role.
      </p>
      <form onSubmit={submit} className="space-y-4 bg-white border border-gray-100 p-6">
        <label className="block text-xs uppercase tracking-widest text-gray-500">
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full border border-gray-200 px-4 py-3 text-sm normal-case tracking-normal focus:outline-none focus:border-black" />
        </label>
        <label className="block text-xs uppercase tracking-widest text-gray-500">
          Role
          <select value={role} onChange={(e) => setRole(e.target.value as RoleChoice)}
            className="mt-2 w-full border border-gray-200 px-4 py-3 text-sm normal-case tracking-normal focus:outline-none focus:border-black">
            <option value="dispatch">Dispatch</option>
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="none">Remove access</option>
          </select>
        </label>
        <p className="text-xs text-gray-500">{ROLE_HELP[role]}</p>
        <button type="submit" disabled={busy}
          className="w-full bg-black text-white py-3 text-xs uppercase tracking-widest hover:bg-gray-800 disabled:opacity-50">
          {busy ? 'Saving...' : 'Save'}
        </button>
        {msg && <p role="status" className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</p>}
      </form>
    </div>
  );
}
