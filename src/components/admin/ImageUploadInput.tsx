// FILE: src/components/admin/ImageUploadInput.tsx
// REPLACE entire existing file with this

import React, { useState } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage as firebaseStorage } from '../../firebase';

interface ImageUploadInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  storagePath?: string;   // optional custom path, default: "uploads"
  maxSizeMB?: number;     // default: 50MB
  quality?: '4k' | '2k' | '1080p' | 'original'; // default: 'original' (no compression)
}

export const ImageUploadInput = ({
  value,
  onChange,
  placeholder,
  storagePath = 'uploads',
  maxSizeMB = 50,
  quality = 'original',
}: ImageUploadInputProps) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');

  // Only resize if quality param is explicitly set (not 'original')
  // For 4K: no resize at all — upload as-is
  const processImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      // 'original' or '4k' = no compression, upload raw file
      if (quality === 'original' || quality === '4k') {
        resolve(file);
        return;
      }

      // For 2k/1080p — only downscale if image is LARGER than target
      const maxWidths: Record<string, number> = {
        '2k': 2560,
        '1080p': 1920,
      };
      const maxWidth = maxWidths[quality] || 1920;

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;
        img.onload = () => {
          // If image is smaller than target, don't upscale
          if (img.width <= maxWidth) {
            resolve(file);
            return;
          }
          const ratio = maxWidth / img.width;
          const canvas = document.createElement('canvas');
          canvas.width = maxWidth;
          canvas.height = Math.round(img.height * ratio);
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (blob) => {
              if (!blob) { resolve(file); return; }
              resolve(new File([blob], file.name, { type: 'image/jpeg' }));
            },
            'image/jpeg',
            0.92  // 92% quality — high quality, not destructive
          );
        };
        img.onerror = () => reject(new Error('Image load failed'));
      };
      reader.onerror = () => reject(new Error('File read failed'));
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';

    setError('');

    // Type check
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Only JPG, PNG, or WebP files allowed.');
      return;
    }

    // Size check
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > maxSizeMB) {
      setError(`File too large. Max ${maxSizeMB}MB allowed. Your file: ${sizeMB.toFixed(1)}MB`);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Process (resize only if needed)
      const processedFile = await processImage(file);

      // Upload to Firebase Storage
      const timestamp = Date.now();
      const ext = file.name.split('.').pop() || 'jpg';
      const filename = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const fullPath = `${storagePath}/${filename}`;

      const storageRef = ref(firebaseStorage, fullPath);
      const uploadTask = uploadBytesResumable(storageRef, processedFile, {
        contentType: processedFile.type,
        cacheControl: 'public,max-age=31536000',
        customMetadata: {
          originalName: file.name,
          originalSize: String(file.size),
          quality: quality,
        },
      });

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const pct = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          );
          setUploadProgress(pct);
        },
        (uploadError) => {
          console.error('Firebase Storage upload error:', uploadError);
          setError('Upload failed. Check Firebase Storage rules and try again.');
          setIsUploading(false);
          setUploadProgress(0);
        },
        async () => {
          // Success — get download URL
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          onChange(downloadUrl);
          setIsUploading(false);
          setUploadProgress(100);
          // Reset progress after short delay
          setTimeout(() => setUploadProgress(0), 1500);
        }
      );
    } catch (err) {
      console.error('Processing error:', err);
      setError('Failed to process image. Please try again.');
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="space-y-2 w-full">
      {/* Main input row */}
      <div className="flex gap-2 w-full">
        <input
          type="text"
          value={value}
          onChange={(e) => { onChange(e.target.value); setError(''); }}
          placeholder={placeholder || 'Paste image URL or click Upload →'}
          className="w-full bg-brand-bg border border-brand-divider px-4 py-3 font-sans text-sm focus:outline-none focus:border-brand-black truncate"
        />
        <button
          type="button"
          onClick={() => { setError(''); fileInputRef.current?.click(); }}
          disabled={isUploading}
          className="px-6 bg-brand-black text-white text-[10px] uppercase tracking-widest font-bold whitespace-nowrap hover:bg-brand-black/80 transition-colors disabled:opacity-50 min-w-[90px]"
        >
          {isUploading ? `${uploadProgress}%` : 'Upload'}
        </button>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
        />
      </div>

      {/* Upload progress bar */}
      {isUploading && (
        <div className="space-y-1">
          <div className="w-full bg-brand-divider h-1">
            <div
              className="bg-brand-black h-1 transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-[10px] text-brand-secondary">
            Uploading to Firebase Storage... {uploadProgress}%
            {uploadProgress === 100 && ' ✓ Done!'}
          </p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="text-[10px] text-red-500 font-medium">{error}</p>
      )}

      {/* Image preview thumbnail (if URL exists) */}
      {value && !value.startsWith('data:') && (
        <div className="flex items-center gap-3 p-2 border border-brand-divider bg-brand-bg">
          <img
            src={value}
            alt="Preview"
            className="w-12 h-12 object-cover border border-brand-divider flex-shrink-0"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-brand-secondary truncate">{value}</p>
            <p className="text-[9px] text-green-600 font-bold mt-0.5">
              ✓ Stored in Firebase Storage
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-[9px] text-red-400 hover:text-red-600 font-bold uppercase tracking-wider flex-shrink-0 px-2"
          >
            Remove
          </button>
        </div>
      )}

      {/* Warning: old base64 image detected */}
      {value && value.startsWith('data:') && (
        <div className="p-3 bg-amber-50 border border-amber-200">
          <p className="text-[10px] text-amber-700 font-bold">
            ⚠ This image is stored as base64 (old format — causes storage issues).
          </p>
          <p className="text-[10px] text-amber-600 mt-1">
            Click "Upload" to re-upload this image to Firebase Storage for better performance.
          </p>
        </div>
      )}
    </div>
  );
};