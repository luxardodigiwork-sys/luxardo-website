import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, Plus, Edit2, Trash2, Image as ImageIcon, Check, X } from 'lucide-react';
import { ImageUploadInput } from '../../components/admin/ImageUploadInput';
import { ConfirmModal } from '../../components/admin/ConfirmModal';
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';

interface Collection {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  longDescription: string;
  bannerImageUrl: string;
  heroImageUrl: string;
  isVisible: boolean;
  sortOrder: number;
}

export default function AdminCollectionsPage() {
  const [collectionsList, setCollectionsList] = useState<Collection[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<Collection | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCollections = async () => {
      try {
        const snap = await getDocs(collection(db, 'categories'));
        if (!snap.empty) {
          const cats = snap.docs.map(d => ({ id: d.id, ...d.data() } as Collection));
          cats.sort((a, b) => a.sortOrder - b.sortOrder);
          setCollectionsList(cats);
        }
      } catch (error) {
        console.error("Error fetching categories:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCollections();
  }, []);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleEdit = (collectionItem: Collection) => {
    setEditingId(collectionItem.id);
    setIsAdding(false);
    setFormData({ ...collectionItem });
  };

  const handleAddNew = () => {
    setIsAdding(true);
    setEditingId(null);
    setFormData({
      id: `col_${Date.now()}`,
      name: '',
      slug: '',
      shortDescription: '',
      longDescription: '',
      bannerImageUrl: '',
      heroImageUrl: '',
      isVisible: true,
      sortOrder: collectionsList.length + 1,
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setIsAdding(false);
    setFormData(null);
  };

  const handleSave = async () => {
    if (!formData) return;
    try {
      await setDoc(doc(db, 'categories', formData.id), formData, { merge: true });
      
      let updatedCollections = isAdding 
        ? [...collectionsList, formData] 
        : collectionsList.map(c => c.id === formData.id ? formData : c);
      
      updatedCollections.sort((a, b) => a.sortOrder - b.sortOrder);
      setCollectionsList(updatedCollections);
      
      setEditingId(null);
      setIsAdding(false);
      setFormData(null);
      showToast(isAdding ? 'Collection added successfully' : 'Collection saved successfully');
    } catch (error) {
      console.error('Error saving collections:', error);
      alert('Failed to save collection to database.');
    }
  };

  const confirmDelete = async () => {
    if (itemToDelete) {
      try {
        await deleteDoc(doc(db, 'categories', itemToDelete));
        setCollectionsList(collectionsList.filter(c => c.id !== itemToDelete));
        showToast('Collection deleted successfully');
      } catch (err) {
        console.error("Delete failed", err);
      } finally {
        setItemToDelete(null);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (!formData) return;
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData({ ...formData, [name]: checked });
    } else if (name === 'sortOrder') {
      setFormData({ ...formData, [name]: parseInt(value) || 0 });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Collections...</div>;

  return (
    <div className="max-w-7xl mx-auto pb-20">
      {toast && (
        <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-none shadow-lg z-50 flex items-center gap-3 ${
          toast.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {toast.type === 'success' ? <Check size={18} /> : <X size={18} />}
          <span className="font-sans text-sm tracking-wide">{toast.message}</span>
        </div>
      )}

      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-4xl md:text-5xl font-display mb-2">Collections</h1>
          <p className="text-brand-secondary font-sans tracking-wide">Manage your product collections (Synced with Live Database).</p>
        </div>
        <button onClick={handleAddNew} className="px-6 py-3 bg-brand-black text-white text-xs font-sans tracking-widest uppercase hover:bg-brand-black/90 transition-colors flex items-center gap-2">
          <Plus size={16} /> Add New Collection
        </button>
      </div>

      <div className="space-y-6">
        {isAdding && formData && (
          <div className="bg-white border border-brand-divider p-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="flex justify-between items-center border-b border-brand-divider pb-4 mb-4">
                <h3 className="font-display text-xl">Add New Collection</h3>
                <div className="flex gap-3">
                  <button onClick={handleCancel} className="px-4 py-2 text-sm font-sans tracking-widest uppercase text-brand-secondary hover:text-brand-black transition-colors">Cancel</button>
                  <button onClick={handleSave} className="px-4 py-2 text-sm font-sans tracking-widest uppercase bg-brand-black text-white hover:bg-brand-black/90 transition-colors flex items-center gap-2"><Save size={16} /> Save</button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-sans tracking-widest uppercase text-brand-secondary mb-2">Collection Name</label>
                    <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full border border-brand-divider px-4 py-2 font-sans text-sm focus:outline-none focus:border-brand-black transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-sans tracking-widest uppercase text-brand-secondary mb-2">Slug (URL Matcher)</label>
                    <input type="text" name="slug" value={formData.slug} onChange={handleChange} placeholder="e.g. suits" className="w-full border border-brand-divider px-4 py-2 font-sans text-sm focus:outline-none focus:border-brand-black transition-colors" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-sans tracking-widest uppercase text-brand-secondary mb-2">Sort Order</label>
                      <input type="number" name="sortOrder" value={formData.sortOrder} onChange={handleChange} className="w-full border border-brand-divider px-4 py-2 font-sans text-sm focus:outline-none focus:border-brand-black transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs font-sans tracking-widest uppercase text-brand-secondary mb-2">Visibility</label>
                      <select name="isVisible" value={formData.isVisible ? "true" : "false"} onChange={(e) => setFormData({...formData, isVisible: e.target.value === "true"})} className="w-full border border-brand-divider px-4 py-2 font-sans text-sm focus:outline-none focus:border-brand-black transition-colors">
                        <option value="true">Visible</option>
                        <option value="false">Hidden</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-sans tracking-widest uppercase text-brand-secondary mb-2">Short Description</label>
                    <textarea name="shortDescription" value={formData.shortDescription} onChange={handleChange} rows={2} className="w-full border border-brand-divider px-4 py-2 font-sans text-sm focus:outline-none focus:border-brand-black transition-colors resize-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-sans tracking-widest uppercase text-brand-secondary mb-2">Long Description</label>
                    <textarea name="longDescription" value={formData.longDescription} onChange={handleChange} rows={4} className="w-full border border-brand-divider px-4 py-2 font-sans text-sm focus:outline-none focus:border-brand-black transition-colors resize-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-brand-divider">
                <div>
                  <label className="block text-xs font-sans tracking-widest uppercase text-brand-secondary mb-2">Banner Image URL</label>
                  <div className="mb-4">
                    <ImageUploadInput value={formData.bannerImageUrl} onChange={(val) => setFormData({ ...formData, bannerImageUrl: val })} />
                  </div>
                  <div className="aspect-[21/9] bg-brand-bg border border-brand-divider relative overflow-hidden flex items-center justify-center">
                    {formData.bannerImageUrl ? <img src={formData.bannerImageUrl} alt="Banner Preview" className="w-full h-full object-cover" /> : <div className="text-brand-secondary"><ImageIcon size={24} className="opacity-50" /></div>}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-sans tracking-widest uppercase text-brand-secondary mb-2">Hero Image URL</label>
                  <div className="mb-4">
                    <ImageUploadInput value={formData.heroImageUrl} onChange={(val) => setFormData({ ...formData, heroImageUrl: val })} />
                  </div>
                  <div className="aspect-[4/3] bg-brand-bg border border-brand-divider relative overflow-hidden flex items-center justify-center">
                    {formData.heroImageUrl ? <img src={formData.heroImageUrl} alt="Hero Preview" className="w-full h-full object-cover" /> : <div className="text-brand-secondary"><ImageIcon size={24} className="opacity-50" /></div>}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {collectionsList.map((collectionItem) => (
          <div key={collectionItem.id} className="bg-white border border-brand-divider p-6">
            {editingId === collectionItem.id && formData ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="flex justify-between items-center border-b border-brand-divider pb-4 mb-4">
                  <h3 className="font-display text-xl">Edit Collection</h3>
                  <div className="flex gap-3">
                    <button onClick={handleCancel} className="px-4 py-2 text-sm font-sans tracking-widest uppercase text-brand-secondary hover:text-brand-black transition-colors">Cancel</button>
                    <button onClick={handleSave} className="px-4 py-2 text-sm font-sans tracking-widest uppercase bg-brand-black text-white hover:bg-brand-black/90 transition-colors flex items-center gap-2"><Save size={16} /> Save</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div><label className="block text-xs font-sans tracking-widest uppercase text-brand-secondary mb-2">Collection Name</label><input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full border border-brand-divider px-4 py-2 font-sans text-sm focus:outline-none focus:border-brand-black transition-colors" /></div>
                    <div><label className="block text-xs font-sans tracking-widest uppercase text-brand-secondary mb-2">Slug (URL Matcher)</label><input type="text" name="slug" value={formData.slug} onChange={handleChange} className="w-full border border-brand-divider px-4 py-2 font-sans text-sm focus:outline-none focus:border-brand-black transition-colors" /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-xs font-sans tracking-widest uppercase text-brand-secondary mb-2">Sort Order</label><input type="number" name="sortOrder" value={formData.sortOrder} onChange={handleChange} className="w-full border border-brand-divider px-4 py-2 font-sans text-sm focus:outline-none focus:border-brand-black transition-colors" /></div>
                      <div><label className="block text-xs font-sans tracking-widest uppercase text-brand-secondary mb-2">Visibility</label><select name="isVisible" value={formData.isVisible ? "true" : "false"} onChange={(e) => setFormData({...formData, isVisible: e.target.value === "true"})} className="w-full border border-brand-divider px-4 py-2 font-sans text-sm focus:outline-none focus:border-brand-black transition-colors"><option value="true">Visible</option><option value="false">Hidden</option></select></div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div><label className="block text-xs font-sans tracking-widest uppercase text-brand-secondary mb-2">Short Description</label><textarea name="shortDescription" value={formData.shortDescription} onChange={handleChange} rows={2} className="w-full border border-brand-divider px-4 py-2 font-sans text-sm focus:outline-none focus:border-brand-black transition-colors resize-none" /></div>
                    <div><label className="block text-xs font-sans tracking-widest uppercase text-brand-secondary mb-2">Long Description</label><textarea name="longDescription" value={formData.longDescription} onChange={handleChange} rows={4} className="w-full border border-brand-divider px-4 py-2 font-sans text-sm focus:outline-none focus:border-brand-black transition-colors resize-none" /></div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-brand-divider">
                  <div>
                    <label className="block text-xs font-sans tracking-widest uppercase text-brand-secondary mb-2">Banner Image URL</label>
                    <div className="mb-4"><ImageUploadInput value={formData.bannerImageUrl} onChange={(val) => setFormData({ ...formData, bannerImageUrl: val })} /></div>
                  </div>
                  <div>
                    <label className="block text-xs font-sans tracking-widest uppercase text-brand-secondary mb-2">Hero Image URL</label>
                    <div className="mb-4"><ImageUploadInput value={formData.heroImageUrl} onChange={(val) => setFormData({ ...formData, heroImageUrl: val })} /></div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                <div className="w-24 h-24 bg-brand-bg border border-brand-divider shrink-0 overflow-hidden">
                  {collectionItem.heroImageUrl ? <img src={collectionItem.heroImageUrl} alt={collectionItem.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-brand-secondary"><ImageIcon size={20} className="opacity-50" /></div>}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-display text-xl">{collectionItem.name}</h3>
                    <span className={`px-2 py-0.5 text-[10px] uppercase tracking-widest ${collectionItem.isVisible ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{collectionItem.isVisible ? 'Visible' : 'Hidden'}</span>
                  </div>
                  <p className="text-sm text-brand-secondary font-sans tracking-wide mb-2">Slug: {collectionItem.slug}</p>
                  <p className="text-sm font-sans line-clamp-2">{collectionItem.shortDescription}</p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-center px-4 border-r border-brand-divider">
                    <span className="block text-xs text-brand-secondary uppercase tracking-widest mb-1">Order</span>
                    <span className="font-sans text-lg">{collectionItem.sortOrder}</span>
                  </div>
                  <button onClick={() => handleEdit(collectionItem)} className="p-2 text-brand-secondary hover:text-brand-black transition-colors" title="Edit Collection"><Edit2 size={18} /></button>
                  <button onClick={() => handleDelete(collectionItem.id)} className="p-2 text-brand-secondary hover:text-red-600 transition-colors" title="Delete Collection"><Trash2 size={18} /></button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <ConfirmModal isOpen={!!itemToDelete} title="Delete Collection" message="Are you sure you want to delete this collection? This action cannot be undone." confirmText="Delete" onConfirm={confirmDelete} onCancel={() => setItemToDelete(null)} />
    </div>
  );
}