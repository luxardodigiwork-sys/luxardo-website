import React, { useState, useEffect } from 'react';
import { Shield, UserPlus, Mail, KeyRound, User, Briefcase, CheckCircle2, AlertCircle } from 'lucide-react';
import { collection, getDocs, doc, setDoc, query, where } from 'firebase/firestore';
import { db, auth } from '../../firebase'; // Aapka main firebase connection
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';

// Taki Admin logout na ho, hum user create karne ke liye ek temporary Firebase connection banayenge
// Note: Iske liye aapko apna firebaseConfig yahan daalna hoga (jo aapki firebase.ts file mein hai)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export default function BackendManagementPage() {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form States
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('dispatch');
  const [isCreating, setIsCreating] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  // Fetch Existing Staff
  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const q = query(collection(db, 'users'), where('role', 'in', ['admin', 'owner', 'dispatch', 'accounts']));
        const snapshot = await getDocs(q);
        const staffList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setStaff(staffList);
      } catch (err) {
        console.error("Error fetching staff:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStaff();
  }, [isCreating]); // Refresh list when new user is created

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setMsg({ type: '', text: '' });

    try {
      // 1. Ek temporary Firebase app start karo taaki main Admin session disturb na ho
      const secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp');
      const secondaryAuth = getAuth(secondaryApp);

      // 2. Auth mein Naya User banao
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const newUserId = userCredential.user.uid;

      // 3. Firestore Database mein role aur details save karo
      await setDoc(doc(db, 'users', newUserId), {
        name: name,
        email: email.toLowerCase(),
        role: role,
        createdAt: new Date().toISOString(),
        status: 'active'
      });

      // 4. Temporary session ko band kar do
      await signOut(secondaryAuth);

      setMsg({ type: 'success', text: `Success! ${name} has been added as ${role.toUpperCase()}.` });
      
      // Form clear karo
      setName('');
      setEmail('');
      setPassword('');
      
    } catch (err: any) {
      console.error(err);
      setMsg({ type: 'error', text: err.message || 'Failed to create user.' });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <div>
        <h1 className="text-3xl font-display uppercase tracking-tight">Staff & Roles</h1>
        <p className="text-brand-secondary font-sans text-sm mt-1">Manage system access for Dispatch, Accounts, and Owners</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Create New User Form */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-brand-divider p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6 border-b border-brand-divider pb-4">
              <UserPlus size={18} className="text-brand-black" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-brand-black">Create New User</h2>
            </div>

            {msg.text && (
              <div className={`p-3 mb-4 text-xs flex items-start gap-2 border ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                {msg.type === 'success' ? <CheckCircle2 size={14} className="mt-0.5" /> : <AlertCircle size={14} className="mt-0.5" />}
                <p>{msg.text}</p>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-brand-secondary mb-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-secondary" size={14} />
                  <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-brand-divider pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-brand-black" placeholder="Ramesh Dispatch" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-brand-secondary mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-secondary" size={14} />
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-brand-divider pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-brand-black" placeholder="team@luxardofashion.com" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-brand-secondary mb-1">Password</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-secondary" size={14} />
                  <input type="text" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border border-brand-divider pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-brand-black" placeholder="Set a secure password" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-brand-secondary mb-1">System Role</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-secondary" size={14} />
                  <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full border border-brand-divider pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-brand-black appearance-none bg-white">
                    <option value="dispatch">Dispatch Team</option>
                    <option value="accounts">Accounts Team</option>
                    <option value="admin">Admin</option>
                    <option value="owner">Owner</option>
                  </select>
                </div>
              </div>

              <button type="submit" disabled={isCreating} className="w-full bg-brand-black text-white py-3 text-xs tracking-widest uppercase font-bold hover:bg-brand-black/90 transition-colors mt-2 disabled:opacity-50">
                {isCreating ? 'Creating User...' : 'Create Account'}
              </button>
            </form>
          </div>
        </div>

        {/* Existing Staff List */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-brand-divider shadow-sm">
            <div className="p-6 border-b border-brand-divider flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield size={18} className="text-brand-black" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-brand-black">Active Staff Members</h2>
              </div>
            </div>
            
            <div className="p-0">
              {loading ? (
                <div className="p-10 flex justify-center"><div className="w-6 h-6 border-2 border-brand-divider border-t-brand-black rounded-full animate-spin"></div></div>
              ) : staff.length > 0 ? (
                <div className="divide-y divide-brand-divider">
                  {staff.map((member) => (
                    <div key={member.id} className="p-4 px-6 flex items-center justify-between hover:bg-brand-bg transition-colors">
                      <div>
                        <p className="font-bold text-sm text-brand-black">{member.name || 'No Name'}</p>
                        <p className="text-xs text-brand-secondary">{member.email}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                        member.role === 'admin' || member.role === 'owner' ? 'bg-black text-white border-black' :
                        member.role === 'accounts' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {member.role}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-10 text-center text-sm text-brand-secondary">No staff members found.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}