import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Save, Plus, Edit2, Trash2, Image as ImageIcon, Check, X, AlertCircle } from 'lucide-react';
import { ImageUploadInput } from '../../components/admin/ImageUploadInput';
import { ConfirmModal } from '../../components/admin/ConfirmModal';
import { collection, doc, getDocs, setDoc, deleteDoc, query, where } from 'firebase/firestore';
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

interface ValidationErrors {
  [key: string]: string;
}

export default function AdminCollectionsPage() {
  const [collectionsList, setCollectionsList] = useState<Collection[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<Collection | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

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
        showToast('Failed to load collections', 'error');
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

  // Validation function - ensures data integrity
  const validateForm = (): ValidationErrors => {
    const errors: ValidationErrors = {};
    
    if (!formData) return errors;
    
    if (!formData.name?.trim()) {
      errors.name = 'Collection name is required';
    }
    
    if (!formData.slug?.trim()) {
      errors.slug = 'Slug is required';
    } else if (!/^[a-z0-9-]+$/.test(formData.slug)) {
      errors.slug = 'Slug must contain only lowercase letters, numbers, and hyphens';
    } else {
      // Check for duplicate slugs (excluding current collection if editing)
      const duplicateSlug = collectionsList.some(
        c => c.slug === formData.slug && c.id !== formData.id
      );
      if (duplicateSlug) {
        errors.slug = 'This slug is already in use';
      }
    }
    
    if (formData.sortOrder < 0) {
      errors.sortOrder = 'Sort order must be a positive number';
    }
    
    return errors;
  };

  const handleEdit = (collectionItem: Collection) => {
    setEditingId(collectionItem.id);
    setIsAdding(false);
    setFormData({ ...collectionItem });
    setValidationErrors({});
  };

  const handleAddNew = () => {
    setIsAdding(true);
    setEditingId(null);
    setValidationErrors({});
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
    setValidationErrors({});
  };

  // FIXED: Missing handleDelete function - critical bug
  const handleDelete = (id: string) => {
    setItemToDelete(id);
  };

  const handleSave = async () => {
    if (!formData) return;
    
    // Validate before saving
    const errors = validateForm();
    setValidationErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      showToast('Please fix the errors below', 'error');
      return;
    }

    setIsSaving(true);
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
      setValidationErrors({});
      showToast(isAdding ? 'Collection added successfully' : 'Collection updated successfully', 'success');
    } catch (error) {
      console.error('Error saving collection:', error);
      showToast('Failed to save collection. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (itemToDelete) {
      setIsSaving(true);
      try {
        await deleteDoc(doc(db, 'categories', itemToDelete));
        setCollectionsList(collectionsList.filter(c => c.id !== itemToDelete));
        showToast('Collection deleted successfully', 'success');
      } catch (error) {
        console.error("Delete failed:", error);
        showToast('Failed to delete collection. Please try again.', 'error');
      } finally {
        setItemToDelete(null);
        setIsSaving(false);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (!formData) return;
    const { name, value, type } = e.target;
    
    // Clear validation error for this field when user starts editing
    if (validationErrors[name]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData({ ...formData, [name]: checked });
    } else if (name === 'sortOrder') {
      setFormData({ ...formData, [name]: parseInt(value) || 0 });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  // Helper to render form fields with validation feedback
  const renderTextField = (
    label: string,
    name: string,
    value: string,
    type: 'text' | 'number' | 'textarea' = 'text',
    placeholder?: string,
    rows?: number
  ) => {
    const error = validationErrors[name];
    const inputClass = `w-full border px-4 py-2 font-sans text-sm focus:outline-none transition-colors resize-none ${
      error 
        ? 'border-red-300 bg-red-50 focus:border-red-500' 
        : 'border-brand-divider focus:border-brand-black'
    }`;

    return (
      <div>
        <label className="block text-xs font-sans tracking-widest uppercase text-brand-secondary mb-2">
          {label}
          {(name === 'name' || name === 'slug') && <span className="text-red-500 ml-1">*</span>}
        </label>
        {type === 'textarea' ? (
          <textarea
            name={name}
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            rows={rows}
            className={inputClass}
          />
        ) : (
          <input
            type={type}
            name={name}
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            className={inputClass}
          />
        )}
        {error && (
          <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
            <AlertCircle size={12} />
            {error}
          </p>
        )}
      </div>
    );
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
        <button 
          onClick={handleAddNew} 
          disabled={isSaving || isAdding}
          className="px-6 py-3 bg-brand-black text-white text-xs font-sans tracking-widest uppercase hover:bg-brand-black/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
          <Plus size={16} /> Add New Collection
        </button>
      </div>

      <div className="space-y-6">
        {(isAdding || editingId) && formData && (
          <div className="bg-white border border-brand-divider p-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="flex justify-between items-center border-b border-brand-divider pb-4 mb-4">
                <h3 className="font-display text-xl">
                  {isAdding ? 'Add New Collection' : 'Edit Collection'}
                </h3>
                <div className="flex gap-3">
                  <button 
                    onClick={handleCancel} 
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-sans tracking-widest uppercase text-brand-secondary hover:text-brand-black transition-colors disabled:opacity-50">
                    Cancel
                  </button>
                  <button 
                    onClick={handleSave} 
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-sans tracking-widest uppercase bg-brand-black text-white hover:bg-brand-black/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                    <Save size={16} /> {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>

              {Object.keys(validationErrors).length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
                  <p className="text-sm font-sans text-red-800 font-semibold mb-2">Please fix the following errors:</p>
                  <ul className="text-sm text-red-700 space-y-1">
                    {Object.entries(validationErrors).map(([field, error]) => (
                      <li key={field} className="flex items-center gap-2">
                        <AlertCircle size={14} />
                        {error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  {renderTextField('Collection Name', 'name', formData.name)}
                  {renderTextField('Slug (URL Matcher)', 'slug', formData.slug, 'text', 'e.g. suits')}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      {renderTextField('Sort Order', 'sortOrder', formData.sortOrder.toString(), 'number')}
                    </div>
                    <div>
                      <label className="block text-xs font-sans tracking-widest uppercase text-brand-secondary mb-2">Visibility</label>
                      <select 
                        name="isVisible" 
                        value={formData.isVisible ? "true" : "false"} 
                        onChange={(e) => setFormData({...formData, isVisible: e.target.value === "true"})}
                        className="w-full border border-brand-divider px-4 py-2 font-sans text-sm focus:outline-none focus:border-brand-black transition-colors">
                        <option value="true">Visible</option>
                        <option value="false">Hidden</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {renderTextField('Short Description', 'shortDescription', formData.shortDescription, 'textarea', undefined, 2)}
                  {renderTextField('Long Description', 'longDescription', formData.longDescription, 'textarea', undefined, 4)}
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
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                {/* Edit mode is now handled in the unified form above */}
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
                  <p className="text-sm text-brand-secondary font-sans tracking-wide mb-2">Slug: <code className="bg-gray-100 px-2 py-1 rounded text-xs">{collectionItem.slug}</code></p>
                  <p className="text-sm font-sans line-clamp-2">{collectionItem.shortDescription}</p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-center px-4 border-r border-brand-divider">
                    <span className="block text-xs text-brand-secondary uppercase tracking-widest mb-1">Order</span>
                    <span className="font-sans text-lg font-semibold">{collectionItem.sortOrder}</span>
                  </div>
                  <button 
                    onClick={() => handleEdit(collectionItem)} 
                    disabled={isSaving}
                    className="p-2 text-brand-secondary hover:text-brand-black transition-colors disabled:opacity-50" 
                    title="Edit Collection">
                    <Edit2 size={18} />
                  </button>
                  <button 
                    onClick={() => handleDelete(collectionItem.id)} 
                    disabled={isSaving}
                    className="p-2 text-brand-secondary hover:text-red-600 transition-colors disabled:opacity-50" 
                    title="Delete Collection">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <ConfirmModal 
        isOpen={!!itemToDelete} 
        title="Delete Collection" 
        message="Are you sure you want to delete this collection? This action cannot be undone." 
        confirmText={isSaving ? 'Deleting...' : 'Delete'} 
        onConfirm={confirmDelete} 
        onCancel={() => setItemToDelete(null)} 
      />
    </div>
  );
}