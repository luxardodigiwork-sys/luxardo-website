import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, Plus, Edit2, Trash2, Image as ImageIcon, Check, X } from 'lucide-react';

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

const DEFAULT_COLLECTIONS: Collection[] = [
  {
    id: '1',
    name: 'Premium Koti Kurta',
    slug: 'premium-koti-kurta',
    shortDescription: 'Elevate your traditional attire with our premium Koti Kurta sets.',
    longDescription: 'Discover the perfect blend of tradition and modernity with our Premium Koti Kurta collection. Each piece is meticulously crafted using the finest fabrics and intricate detailing.',
    bannerImageUrl: 'https://images.unsplash.com/photo-1595341596012-09c67cb0f10c?auto=format&fit=crop&q=80&w=2000',
    heroImageUrl: 'https://images.unsplash.com/photo-1595341596012-09c67cb0f10c?auto=format&fit=crop&q=80&w=800',
    isVisible: true,
    sortOrder: 1,
  },
  {
    id: '2',
    name: 'Premium Kurta Editions',
    slug: 'premium-kurta-editions',
    shortDescription: 'Timeless elegance in every thread.',
    longDescription: 'Our Premium Kurta Editions offer a sophisticated take on classic Indian wear. Perfect for festive occasions and formal gatherings.',
    bannerImageUrl: 'https://images.unsplash.com/photo-1597983073493-88cd35cf93b0?auto=format&fit=crop&q=80&w=2000',
    heroImageUrl: 'https://images.unsplash.com/photo-1597983073493-88cd35cf93b0?auto=format&fit=crop&q=80&w=800',
    isVisible: true,
    sortOrder: 2,
  },
  {
    id: '3',
    name: 'Premium Shirt Trouser',
    slug: 'premium-shirt-trouser',
    shortDescription: 'Contemporary classics for the modern gentleman.',
    longDescription: 'Experience unparalleled comfort and style with our Premium Shirt Trouser collection. Tailored to perfection for a flawless fit.',
    bannerImageUrl: 'https://images.unsplash.com/photo-1594938298596-03ef94f1dc5c?auto=format&fit=crop&q=80&w=2000',
    heroImageUrl: 'https://images.unsplash.com/photo-1594938298596-03ef94f1dc5c?auto=format&fit=crop&q=80&w=800',
    isVisible: true,
    sortOrder: 3,
  },
  {
    id: '4',
    name: 'Premium Tuxedo & Suits',
    slug: 'premium-tuxedo-suits',
    shortDescription: 'Make a statement at your next formal event.',
    longDescription: 'Our Premium Tuxedo & Suits collection is designed for those who demand the best. Impeccable tailoring and luxurious fabrics ensure you look your absolute best.',
    bannerImageUrl: 'https://images.unsplash.com/photo-1593030761757-71fae46af504?auto=format&fit=crop&q=80&w=2000',
    heroImageUrl: 'https://images.unsplash.com/photo-1593030761757-71fae46af504?auto=format&fit=crop&q=80&w=800',
    isVisible: true,
    sortOrder: 4,
  },
  {
    id: '5',
    name: 'Premium Bomber Jackets',
    slug: 'premium-bomber-jackets',
    shortDescription: 'Urban edge meets premium craftsmanship.',
    longDescription: 'Add a touch of contemporary style to your wardrobe with our Premium Bomber Jackets. Versatile, stylish, and crafted to last.',
    bannerImageUrl: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&q=80&w=2000',
    heroImageUrl: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&q=80&w=800',
    isVisible: true,
    sortOrder: 5,
  },
];

export default function AdminCollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Collection | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('luxardo_admin_collections');
    if (stored) {
      try {
        setCollections(JSON.parse(stored));
      } catch (e) {
        setCollections(DEFAULT_COLLECTIONS);
      }
    } else {
      setCollections(DEFAULT_COLLECTIONS);
      localStorage.setItem('luxardo_admin_collections', JSON.stringify(DEFAULT_COLLECTIONS));
    }
  }, []);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleEdit = (collection: Collection) => {
    setEditingId(collection.id);
    setFormData({ ...collection });
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData(null);
  };

  const handleSave = () => {
    if (!formData) return;

    const updatedCollections = collections.map(c => 
      c.id === formData.id ? formData : c
    );
    
    // Sort by sortOrder
    updatedCollections.sort((a, b) => a.sortOrder - b.sortOrder);

    setCollections(updatedCollections);
    localStorage.setItem('luxardo_admin_collections', JSON.stringify(updatedCollections));
    
    setEditingId(null);
    setFormData(null);
    showToast('Collection saved successfully');
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

  return (
    <div className="max-w-7xl mx-auto pb-20">
      {/* Toast Notification */}
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
          <p className="text-brand-secondary font-sans tracking-wide">Manage your product collections and categories.</p>
        </div>
      </div>

      <div className="space-y-6">
        {collections.map((collection) => (
          <div key={collection.id} className="bg-white border border-brand-divider p-6">
            {editingId === collection.id && formData ? (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center border-b border-brand-divider pb-4 mb-4">
                  <h3 className="font-display text-xl">Edit Collection</h3>
                  <div className="flex gap-3">
                    <button 
                      onClick={handleCancel}
                      className="px-4 py-2 text-sm font-sans tracking-widest uppercase text-brand-secondary hover:text-brand-black transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSave}
                      className="px-4 py-2 text-sm font-sans tracking-widest uppercase bg-brand-black text-white hover:bg-brand-black/90 transition-colors flex items-center gap-2"
                    >
                      <Save size={16} />
                      Save
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-sans tracking-widest uppercase text-brand-secondary mb-2">Collection Name</label>
                      <input 
                        type="text" 
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        className="w-full border border-brand-divider px-4 py-2 font-sans text-sm focus:outline-none focus:border-brand-black transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-sans tracking-widest uppercase text-brand-secondary mb-2">Slug</label>
                      <input 
                        type="text" 
                        name="slug"
                        value={formData.slug}
                        onChange={handleChange}
                        className="w-full border border-brand-divider px-4 py-2 font-sans text-sm focus:outline-none focus:border-brand-black transition-colors"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-sans tracking-widest uppercase text-brand-secondary mb-2">Sort Order</label>
                        <input 
                          type="number" 
                          name="sortOrder"
                          value={formData.sortOrder}
                          onChange={handleChange}
                          className="w-full border border-brand-divider px-4 py-2 font-sans text-sm focus:outline-none focus:border-brand-black transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-sans tracking-widest uppercase text-brand-secondary mb-2">Visibility</label>
                        <select
                          name="isVisible"
                          value={formData.isVisible ? "true" : "false"}
                          onChange={(e) => setFormData({...formData, isVisible: e.target.value === "true"})}
                          className="w-full border border-brand-divider px-4 py-2 font-sans text-sm focus:outline-none focus:border-brand-black transition-colors"
                        >
                          <option value="true">Visible</option>
                          <option value="false">Hidden</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-sans tracking-widest uppercase text-brand-secondary mb-2">Short Description</label>
                      <textarea 
                        name="shortDescription"
                        value={formData.shortDescription}
                        onChange={handleChange}
                        rows={2}
                        className="w-full border border-brand-divider px-4 py-2 font-sans text-sm focus:outline-none focus:border-brand-black transition-colors resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-sans tracking-widest uppercase text-brand-secondary mb-2">Long Description</label>
                      <textarea 
                        name="longDescription"
                        value={formData.longDescription}
                        onChange={handleChange}
                        rows={4}
                        className="w-full border border-brand-divider px-4 py-2 font-sans text-sm focus:outline-none focus:border-brand-black transition-colors resize-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-brand-divider">
                  <div>
                    <label className="block text-xs font-sans tracking-widest uppercase text-brand-secondary mb-2">Banner Image URL</label>
                    <input 
                      type="text" 
                      name="bannerImageUrl"
                      value={formData.bannerImageUrl}
                      onChange={handleChange}
                      className="w-full border border-brand-divider px-4 py-2 font-sans text-sm focus:outline-none focus:border-brand-black transition-colors mb-4"
                    />
                    <div className="aspect-[21/9] bg-brand-bg border border-brand-divider relative overflow-hidden flex items-center justify-center">
                      {formData.bannerImageUrl ? (
                        <img src={formData.bannerImageUrl} alt="Banner Preview" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                      ) : (
                        <div className="text-brand-secondary flex flex-col items-center">
                          <ImageIcon size={24} className="mb-2 opacity-50" />
                          <span className="text-xs uppercase tracking-widest">No Image</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-sans tracking-widest uppercase text-brand-secondary mb-2">Hero Image URL</label>
                    <input 
                      type="text" 
                      name="heroImageUrl"
                      value={formData.heroImageUrl}
                      onChange={handleChange}
                      className="w-full border border-brand-divider px-4 py-2 font-sans text-sm focus:outline-none focus:border-brand-black transition-colors mb-4"
                    />
                    <div className="aspect-[4/3] bg-brand-bg border border-brand-divider relative overflow-hidden flex items-center justify-center">
                      {formData.heroImageUrl ? (
                        <img src={formData.heroImageUrl} alt="Hero Preview" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                      ) : (
                        <div className="text-brand-secondary flex flex-col items-center">
                          <ImageIcon size={24} className="mb-2 opacity-50" />
                          <span className="text-xs uppercase tracking-widest">No Image</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                <div className="w-24 h-24 bg-brand-bg border border-brand-divider shrink-0 overflow-hidden">
                  {collection.heroImageUrl ? (
                    <img src={collection.heroImageUrl} alt={collection.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-brand-secondary">
                      <ImageIcon size={20} className="opacity-50" />
                    </div>
                  )}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-display text-xl">{collection.name}</h3>
                    <span className={`px-2 py-0.5 text-[10px] uppercase tracking-widest ${collection.isVisible ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {collection.isVisible ? 'Visible' : 'Hidden'}
                    </span>
                  </div>
                  <p className="text-sm text-brand-secondary font-sans tracking-wide mb-2">/{collection.slug}</p>
                  <p className="text-sm font-sans line-clamp-2">{collection.shortDescription}</p>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-center px-4 border-r border-brand-divider">
                    <span className="block text-xs text-brand-secondary uppercase tracking-widest mb-1">Order</span>
                    <span className="font-sans text-lg">{collection.sortOrder}</span>
                  </div>
                  <button 
                    onClick={() => handleEdit(collection)}
                    className="p-2 text-brand-secondary hover:text-brand-black transition-colors"
                  >
                    <Edit2 size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
