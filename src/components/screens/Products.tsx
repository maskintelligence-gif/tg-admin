import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus, Search, Edit2, Trash2, X, Save, Loader2, Package,
  Camera, Image as ImageIcon, Link2, AlertTriangle, Check,
  ArrowLeft, ArrowRight, Star, RefreshCw,
  Upload, CheckCircle2, XCircle, ChevronDown, BookImage,
} from 'lucide-react';
import { MediaLibrary } from './MediaLibrary';
import { supabase } from '../../lib/supabase';
import {
  compressImage, uploadToStorage, deleteFromStorage,
  makeLocalId, ImageItem, ImageStatus,
} from '../../lib/imageUtils';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Product {
  product_id: string;
  product_name: string;
  description: string;
  price: number;
  original_price: number | null;
  category: string;
  stock_quantity: number;
  featured: boolean;
  specs: Record<string, string> | null;
  primary_image_url: string | null;
  rating: number;
  review_count: number;
  product_images?: { image_url: string; display_order: number }[];
}

const CATEGORIES = [
  'Phones', 'Laptops', 'Audio', 'Accessories',
  'Home Appliances', 'Cameras', 'Gaming', 'Other',
];

function fmtUGX(n: number) { return `UGX ${n.toLocaleString()}`; }

// ─── Image upload status badge ─────────────────────────────────────────────────

function UploadBadge({ status, progress }: { status: ImageStatus; progress: number }) {
  if (status === 'done') return (
    <div className="absolute inset-0 flex items-center justify-center rounded-xl"
      style={{ background: 'rgba(16,185,129,0.15)' }}>
      <CheckCircle2 size={22} style={{ color: 'var(--emerald)' }} />
    </div>
  );
  if (status === 'error') return (
    <div className="absolute inset-0 flex items-center justify-center rounded-xl"
      style={{ background: 'rgba(244,63,94,0.2)' }}>
      <XCircle size={22} style={{ color: 'var(--rose)' }} />
    </div>
  );
  if (status === 'compressing' || status === 'uploading') return (
    <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl"
      style={{ background: 'rgba(8,13,26,0.65)' }}>
      {status === 'compressing'
        ? <Loader2 size={18} className="animate-spin" style={{ color: 'var(--accent)' }} />
        : (
          <div className="w-10 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.2)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: 'var(--accent)' }} />
          </div>
        )
      }
      <p className="text-[9px] mt-1 font-bold" style={{ color: 'white' }}>
        {status === 'compressing' ? 'Compressing…' : `${progress}%`}
      </p>
    </div>
  );
  return null;
}

// ─── Image gallery manager ─────────────────────────────────────────────────────

interface GalleryManagerProps {
  images: ImageItem[];
  onChange: (imgs: ImageItem[]) => void;
  productId: string; // 'new' until product is saved
}

function GalleryManager({ images, onChange, productId }: GalleryManagerProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState('');
  const [urlMode, setUrlMode] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);

  // Process a file: compress → preview → upload
  const processFile = useCallback(async (file: File, source: 'camera' | 'gallery') => {
    const localId = makeLocalId();
    const preview = URL.createObjectURL(file);

    // Add immediately as compressing
    const item: ImageItem = {
      localId, url: '', preview, source, status: 'compressing', progress: 0,
    };
    onChange((prev) => [...prev, item]);

    try {
      // 1. Compress
      const blob = await compressImage(file, 1200, 0.82);

      // Update to uploading
      onChange((prev) =>
        prev.map((i) => i.localId === localId ? { ...i, status: 'uploading', progress: 0 } : i)
      );

      // 2. Upload — use productId if real, else a temp folder
      const folder = productId === 'new' ? `temp-${Date.now()}` : productId;
      const { url, path } = await uploadToStorage(blob, folder, (pct) => {
        onChange((prev) =>
          prev.map((i) => i.localId === localId ? { ...i, progress: pct } : i)
        );
      });

      // 3. Done
      onChange((prev) =>
        prev.map((i) =>
          i.localId === localId
            ? { ...i, url, storagePath: path, status: 'done', progress: 100 }
            : i
        )
      );
      URL.revokeObjectURL(preview);
    } catch (err) {
      console.error('Upload failed:', err);
      onChange((prev) =>
        prev.map((i) =>
          i.localId === localId
            ? { ...i, status: 'error', error: (err as Error).message }
            : i
        )
      );
    }
  }, [productId]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>, source: 'camera' | 'gallery') => {
    const files = Array.from(e.target.files || []);
    files.forEach((f) => processFile(f, source));
    e.target.value = ''; // reset so same file can be re-selected
  };

  const handleAddUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    try { new URL(url); } catch { return; } // basic validation
    const item: ImageItem = {
      localId: makeLocalId(), url, preview: url,
      source: 'url', status: 'done', progress: 100,
    };
    onChange((prev) => [...prev, item]);
    setUrlInput('');
    setUrlMode(false);
  };

  const remove = (localId: string) => {
    const item = images.find((i) => i.localId === localId);
    // Try to delete from storage in background (don't block UI)
    if (item?.storagePath) deleteFromStorage(item.storagePath).catch(() => {});
    if (item?.preview && item.preview !== item.url) URL.revokeObjectURL(item.preview);
    onChange((prev) => prev.filter((i) => i.localId !== localId));
  };

  const retry = (localId: string) => {
    // Remove and user will re-add manually
    onChange((prev) => prev.filter((i) => i.localId !== localId));
  };

  const move = (localId: string, dir: -1 | 1) => {
    onChange((prev) => {
      const idx = prev.findIndex((i) => i.localId === localId);
      if (idx < 0) return prev;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
  };

  const setPrimary = (localId: string) => {
    onChange((prev) => {
      const idx = prev.findIndex((i) => i.localId === localId);
      if (idx <= 0) return prev;
      const arr = [...prev];
      const [item] = arr.splice(idx, 1);
      arr.unshift(item);
      return arr;
    });
  };

  const isUploading = images.some((i) => i.status === 'compressing' || i.status === 'uploading');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text3)' }}>
          Photos · {images.length} image{images.length !== 1 ? 's' : ''}
        </label>
        {isUploading && (
          <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--amber)' }}>
            <Loader2 size={10} className="animate-spin" /> Uploading…
          </span>
        )}
      </div>

      {/* Image grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((img, idx) => (
            <div key={img.localId} className="relative group">
              {/* Thumbnail */}
              <div className="relative w-full aspect-square rounded-xl overflow-hidden"
                style={{
                  border: `2px solid ${idx === 0 ? 'var(--accent)' : 'var(--border)'}`,
                  background: 'var(--surface2)',
                }}>
                <img src={img.preview || img.url} alt="" className="w-full h-full object-cover" />
                <UploadBadge status={img.status} progress={img.progress} />

                {/* Primary label */}
                {idx === 0 && (
                  <span className="absolute bottom-0 left-0 right-0 text-[9px] text-center py-0.5 font-bold"
                    style={{ background: 'var(--accent)', color: 'white' }}>
                    PRIMARY
                  </span>
                )}

                {/* Error retry overlay */}
                {img.status === 'error' && (
                  <button onClick={() => retry(img.localId)}
                    className="absolute inset-0 flex flex-col items-center justify-center rounded-xl"
                    style={{ background: 'rgba(244,63,94,0.25)' }}>
                    <RefreshCw size={14} style={{ color: 'var(--rose)' }} />
                    <span className="text-[9px] mt-0.5" style={{ color: 'var(--rose)' }}>Retry</span>
                  </button>
                )}
              </div>

              {/* Controls below thumbnail */}
              <div className="flex items-center justify-between mt-1 gap-0.5">
                {/* Move left */}
                <button onClick={() => move(img.localId, -1)} disabled={idx === 0}
                  className="flex-1 flex items-center justify-center py-1 rounded-lg disabled:opacity-20 transition-all active:scale-90"
                  style={{ background: 'var(--surface2)' }}>
                  <ArrowLeft size={11} style={{ color: 'var(--text2)' }} />
                </button>

                {/* Set primary (if not already) */}
                {idx !== 0 && (
                  <button onClick={() => setPrimary(img.localId)}
                    className="flex-1 flex items-center justify-center py-1 rounded-lg transition-all active:scale-90"
                    style={{ background: 'var(--surface2)' }}>
                    <Star size={11} style={{ color: 'var(--amber)' }} />
                  </button>
                )}
                {idx === 0 && <div className="flex-1" />}

                {/* Delete */}
                <button onClick={() => remove(img.localId)}
                  className="flex-1 flex items-center justify-center py-1 rounded-lg transition-all active:scale-90"
                  style={{ background: 'var(--surface2)' }}>
                  <X size={11} style={{ color: 'var(--rose)' }} />
                </button>

                {/* Move right */}
                <button onClick={() => move(img.localId, 1)} disabled={idx === images.length - 1}
                  className="flex-1 flex items-center justify-center py-1 rounded-lg disabled:opacity-20 transition-all active:scale-90"
                  style={{ background: 'var(--surface2)' }}>
                  <ArrowRight size={11} style={{ color: 'var(--text2)' }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add image buttons */}
      <div className="grid grid-cols-3 gap-2">
        {/* Camera */}
        <button onClick={() => cameraRef.current?.click()}
          className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl transition-all active:scale-95"
          style={{ background: 'var(--surface2)', border: '1px dashed var(--border2)' }}>
          <Camera size={18} style={{ color: 'var(--accent)' }} />
          <span className="text-[10px] font-semibold" style={{ color: 'var(--text2)' }}>Camera</span>
        </button>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => handleFileInput(e, 'camera')}
        />

        {/* Gallery */}
        <button onClick={() => galleryRef.current?.click()}
          className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl transition-all active:scale-95"
          style={{ background: 'var(--surface2)', border: '1px dashed var(--border2)' }}>
          <ImageIcon size={18} style={{ color: 'var(--purple)' }} />
          <span className="text-[10px] font-semibold" style={{ color: 'var(--text2)' }}>Gallery</span>
        </button>
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFileInput(e, 'gallery')}
        />

        {/* URL */}
        <button onClick={() => setUrlMode((v) => !v)}
          className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl transition-all active:scale-95"
          style={{
            background: urlMode ? 'var(--accent)20' : 'var(--surface2)',
            border: `1px dashed ${urlMode ? 'var(--accent)' : 'var(--border2)'}`,
          }}>
          <Link2 size={18} style={{ color: urlMode ? 'var(--accent)' : 'var(--text2)' }} />
          <span className="text-[10px] font-semibold" style={{ color: urlMode ? 'var(--accent)' : 'var(--text2)' }}>
            Paste URL
          </span>
        </button>
      </div>

      {/* Library button */}
      <button onClick={() => setShowLibrary(true)}
        className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl transition-all active:scale-95 col-span-3"
        style={{ background: 'var(--surface2)', border: '1px dashed var(--border2)' }}>
        <BookImage size={18} style={{ color: 'var(--emerald)' }} />
        <span className="text-[10px] font-semibold" style={{ color: 'var(--text2)' }}>
          Pick from Media Library
        </span>
      </button>

      {/* URL input */}
      {urlMode && (
        <div className="flex gap-2 animate-fade-in">
          <input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
            placeholder="https://example.com/image.jpg"
            autoFocus
            className="flex-1 px-3 py-2.5 rounded-xl text-sm focus:outline-none"
            style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)' }}
          />
          <button onClick={handleAddUrl}
            className="px-4 rounded-xl font-bold text-sm transition-all active:scale-95"
            style={{ background: 'var(--accent)', color: 'white' }}>
            Add
          </button>
        </div>
      )}

      <p className="text-[10px]" style={{ color: 'var(--text3)' }}>
        First image = primary. Images are compressed to JPEG before uploading.{' '}
        Use ← → to reorder · ★ to set primary.
      </p>

      {/* Media Library Picker */}
      {showLibrary && (
        <div className="fixed inset-0 z-[55] flex flex-col" style={{ background: 'var(--bg)' }}>
          <MediaLibrary
            pickerMode
            initialSelected={images.filter(i => i.status === 'done').map(i => i.url)}
            onPickerCancel={() => setShowLibrary(false)}
            onPickerConfirm={(picked) => {
              const newItems = picked
                .filter(p => !images.some(i => i.url === p.url))
                .map(p => ({
                  localId: makeLocalId(),
                  url: p.url,
                  preview: p.url,
                  source: 'url' as const,
                  status: 'done' as ImageStatus,
                  progress: 100,
                  storagePath: p.path,
                }));
              onChange(prev => [...prev, ...newItems]);
              setShowLibrary(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Product Form ──────────────────────────────────────────────────────────────

function ProductForm({ product, onSave, onClose }: {
  product?: Product; onSave: () => void; onClose: () => void;
}) {
  const isEdit = !!product;
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [form, setForm] = useState({
    product_name: product?.product_name || '',
    description: product?.description || '',
    price: product?.price?.toString() || '',
    original_price: product?.original_price?.toString() || '',
    category: product?.category || 'Phones',
    stock_quantity: product?.stock_quantity?.toString() || '1',
    featured: product?.featured || false,
  });

  const [specsText, setSpecsText] = useState(
    product?.specs
      ? Object.entries(product.specs).map(([k, v]) => `${k}: ${v}`).join('\n')
      : '',
  );

  // Build initial image list from existing product
  const initialImages: ImageItem[] = (
    product?.product_images?.length
      ? product.product_images
      : product?.primary_image_url
        ? [{ image_url: product.primary_image_url, display_order: 0 }]
        : []
  )
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .map((img) => ({
      localId: makeLocalId(),
      url: img.image_url,
      preview: img.image_url,
      source: 'url' as const,
      status: 'done' as ImageStatus,
      progress: 100,
    }));

  const [images, setImages] = useState<ImageItem[]>(initialImages);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.product_name.trim()) e.product_name = 'Name required';
    if (!form.price || isNaN(Number(form.price)) || Number(form.price) <= 0) e.price = 'Valid price required';
    if (!form.stock_quantity || isNaN(Number(form.stock_quantity))) e.stock_quantity = 'Valid stock required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const parseSpecs = (): Record<string, string> | null => {
    if (!specsText.trim()) return null;
    const result: Record<string, string> = {};
    specsText.split('\n').forEach((line) => {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const k = line.slice(0, colonIdx).trim();
        const v = line.slice(colonIdx + 1).trim();
        if (k && v) result[k] = v;
      }
    });
    return Object.keys(result).length ? result : null;
  };

  const isUploading = images.some(
    (i) => i.status === 'compressing' || i.status === 'uploading',
  );

  const handleSave = async () => {
    if (!validate()) return;
    if (isUploading) {
      setSaveError('Please wait — images are still uploading.');
      return;
    }

    const doneImages = images.filter((i) => i.status === 'done' && i.url);
    if (doneImages.length === 0 && images.some((i) => i.status === 'error')) {
      setSaveError('Some images failed to upload. Remove them or retry.');
      return;
    }

    setSaving(true);
    setSaveError('');

    try {
      const primaryUrl = doneImages[0]?.url ?? null;
      const slug = form.product_name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

      const payload = {
        product_name: form.product_name.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        original_price: form.original_price ? Number(form.original_price) : null,
        category: form.category,
        stock_quantity: Number(form.stock_quantity),
        featured: form.featured,
        primary_image_url: primaryUrl,
        specs: parseSpecs(),
        updated_at: new Date().toISOString(),
      };

      let targetId = product?.product_id;

      if (isEdit) {
        await supabase.from('products').update(payload).eq('product_id', targetId!);
        await supabase.from('product_images').delete().eq('product_id', targetId!);
      } else {
        const { data: newProd, error } = await supabase
          .from('products')
          .insert({ ...payload, slug })
          .select('product_id')
          .single();
        if (error) throw error;
        targetId = newProd.product_id;
      }

      // Insert product_images rows
      if (doneImages.length > 0) {
        await supabase.from('product_images').insert(
          doneImages.map((img, i) => ({
            product_id: targetId,
            image_url: img.url,
            display_order: i,
          })),
        );
      }

      onSave();
    } catch (err) {
      setSaveError((err as Error).message || 'Failed to save product');
      setSaving(false);
    }
  };

  const f = (label: string, key: keyof typeof form, opts?: { type?: string; placeholder?: string }) => (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text3)' }}>
        {label}
      </label>
      <input
        type={opts?.type || 'text'}
        inputMode={opts?.type === 'number' ? 'numeric' : undefined}
        value={form[key] as string}
        onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
        placeholder={opts?.placeholder}
        className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
        style={{
          background: 'var(--surface2)', color: 'var(--text)',
          border: `1px solid ${errors[key] ? 'var(--rose)' : 'var(--border)'}`,
        }}
      />
      {errors[key] && <p className="text-xs mt-1" style={{ color: 'var(--rose)' }}>{errors[key]}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 flex-shrink-0"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <h2 className="font-display font-bold text-lg" style={{ color: 'var(--text)' }}>
          {isEdit ? 'Edit Product' : 'Add Product'}
        </h2>
        <button onClick={onClose} className="p-2 rounded-xl" style={{ background: 'var(--surface2)' }}>
          <X size={18} style={{ color: 'var(--text2)' }} />
        </button>
      </div>

      {/* Scrollable form body - FIXED: Added extra bottom padding to account for bottom nav */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5" style={{ paddingBottom: '180px' }}>
        {/* ── Images (first — mobile photographers add photo first) ── */}
        <GalleryManager
          images={images}
          onChange={setImages}
          productId={product?.product_id ?? 'new'}
        />

        <div style={{ height: '1px', background: 'var(--border)' }} />

        {/* ── Core fields ── */}
        {f('Product Name *', 'product_name', { placeholder: 'e.g. Samsung Galaxy A55' })}

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text3)' }}>
            Description
          </label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="Brief product description..."
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none resize-none"
            style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)' }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {f('Price (UGX) *', 'price', { type: 'number', placeholder: '650000' })}
          {f('Original / Old Price', 'original_price', { type: 'number', placeholder: '800000' })}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text3)' }}>
              Category
            </label>
            <div className="relative">
              <select
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                className="w-full px-4 py-3 pr-8 rounded-xl text-sm focus:outline-none appearance-none"
                style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)' }}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--text3)' }} />
            </div>
          </div>
          {f('Stock Qty *', 'stock_quantity', { type: 'number', placeholder: '10' })}
        </div>

        {/* Featured toggle */}
        <button
          onClick={() => setForm((p) => ({ ...p, featured: !p.featured }))}
          className="flex items-center justify-between w-full px-4 py-3.5 rounded-xl transition-all active:scale-98"
          style={{
            background: 'var(--surface2)',
            border: `1px solid ${form.featured ? 'var(--accent)50' : 'var(--border)'}`,
          }}>
          <div>
            <p className="text-sm font-medium text-left" style={{ color: 'var(--text)' }}>Feature on homepage</p>
            <p className="text-xs text-left mt-0.5" style={{ color: 'var(--text3)' }}>
              Appears at top of the storefront
            </p>
          </div>
          <div className="w-12 h-6 rounded-full transition-all relative flex-shrink-0 ml-4"
            style={{ background: form.featured ? 'var(--accent)' : 'var(--border2)' }}>
            <div className="w-5 h-5 rounded-full absolute top-0.5 transition-all"
              style={{ background: 'white', left: form.featured ? '26px' : '2px', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
          </div>
        </button>

        {/* Specs */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text3)' }}>
            Specs <span style={{ color: 'var(--text3)', fontWeight: 400, textTransform: 'none' }}>(one per line)</span>
          </label>
          <textarea
            rows={5}
            value={specsText}
            onChange={(e) => setSpecsText(e.target.value)}
            placeholder={'RAM: 8GB\nStorage: 256GB\nBattery: 5000mAh\nScreen: 6.5 inch AMOLED'}
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none font-mono resize-none"
            style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)' }}
          />
          <p className="text-[10px] mt-1" style={{ color: 'var(--text3)' }}>Format: Label: Value</p>
        </div>

        {/* Upload in progress warning */}
        {isUploading && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
            style={{ background: 'var(--amber)15', border: '1px solid var(--amber)40' }}>
            <Loader2 size={14} className="animate-spin" style={{ color: 'var(--amber)' }} />
            <p className="text-sm" style={{ color: 'var(--amber)' }}>
              Images uploading — save will be enabled when done
            </p>
          </div>
        )}

        {/* Save error */}
        {saveError && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
            style={{ background: 'var(--rose)15', border: '1px solid var(--rose)40' }}>
            <AlertTriangle size={14} style={{ color: 'var(--rose)' }} />
            <p className="text-sm" style={{ color: 'var(--rose)' }}>{saveError}</p>
          </div>
        )}
      </div>

      {/* Footer: Save button */}
      <div
        className="px-4 py-4 flex-shrink-0"
        style={{
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
        }}
      >
        {/* Image summary */}
        {images.length > 0 && (
          <div className="flex items-center gap-1.5 mb-3">
            {images.slice(0, 5).map((img, i) => (
              <div key={img.localId} className="w-8 h-8 rounded-lg overflow-hidden"
                style={{ border: `1.5px solid ${i === 0 ? 'var(--accent)' : 'var(--border)'}`, background: 'var(--surface2)' }}>
                <img src={img.preview || img.url} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
            {images.length > 5 && (
              <span className="text-xs" style={{ color: 'var(--text3)' }}>+{images.length - 5} more</span>
            )}
            <span className="ml-auto text-xs" style={{ color: 'var(--text3)' }}>
              {images.filter((i) => i.status === 'done').length}/{images.length} ready
            </span>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving || isUploading}
          className="w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-98"
          style={{
            background: saving || isUploading ? 'var(--border2)' : 'var(--accent)',
            color: 'white',
            cursor: saving || isUploading ? 'not-allowed' : 'pointer',
          }}>
          {saving ? (
            <><Loader2 size={18} className="animate-spin" /> Saving…</>
          ) : isUploading ? (
            <><Upload size={18} /> Waiting for uploads…</>
          ) : (
            <><Save size={18} /> {isEdit ? 'Save Changes' : 'Add Product'}</>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Product card ──────────────────────────────────────────────────────────────

function ProductCard({ product, onEdit, onDelete }: {
  product: Product; onEdit: () => void; onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isLowStock = product.stock_quantity > 0 && product.stock_quantity < 5;
  const isOutOfStock = product.stock_quantity === 0;

  const doDelete = async () => {
    setDeleting(true);
    await supabase.from('products').delete().eq('product_id', product.product_id);
    onDelete();
  };

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex gap-3 p-3">
        <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center"
          style={{ background: 'var(--surface2)' }}>
          {product.primary_image_url
            ? <img src={product.primary_image_url} alt={product.product_name} className="w-full h-full object-cover" />
            : <Package size={20} style={{ color: 'var(--text3)' }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
              {product.product_name}
            </p>
            {product.featured && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                style={{ background: 'var(--accent)20', color: 'var(--accent)' }}>FEATURED</span>
            )}
          </div>
          <p className="text-xs" style={{ color: 'var(--text3)' }}>{product.category}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm font-mono font-bold" style={{ color: 'var(--emerald)' }}>
              {fmtUGX(product.price)}
            </span>
            <span className="text-xs font-bold flex items-center gap-1"
              style={{ color: isOutOfStock ? 'var(--rose)' : isLowStock ? 'var(--amber)' : 'var(--text3)' }}>
              {(isOutOfStock || isLowStock) && <AlertTriangle size={10} />}
              {product.stock_quantity} in stock
            </span>
          </div>
          {product.product_images && product.product_images.length > 1 && (
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text3)' }}>
              {product.product_images.length} photos
            </p>
          )}
        </div>
      </div>

      {!confirmDelete ? (
        <div className="flex border-t" style={{ borderColor: 'var(--border)' }}>
          <button onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-all active:scale-95"
            style={{ color: 'var(--accent)' }}>
            <Edit2 size={14} /> Edit
          </button>
          <div style={{ width: '1px', background: 'var(--border)' }} />
          <button onClick={() => setConfirmDelete(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-all active:scale-95"
            style={{ color: 'var(--rose)' }}>
            <Trash2 size={14} /> Delete
          </button>
        </div>
      ) : (
        <div className="flex border-t items-center px-3 py-2 gap-2" style={{ borderColor: 'var(--border)' }}>
          <p className="text-xs flex-1" style={{ color: 'var(--text2)' }}>Delete this product?</p>
          <button onClick={() => setConfirmDelete(false)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>
            Cancel
          </button>
          <button onClick={doDelete} disabled={deleting}
            className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1"
            style={{ background: 'var(--rose)', color: 'white' }}>
            {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export function ProductsScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | undefined>();

  const load = async () => {
    setLoading(true);
    setLoadError('');
    const { data, error } = await supabase
      .from('products')
      .select('*, product_images(image_url, display_order)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      console.error('Products fetch error:', error);
      setLoadError(error.message);
      setLoading(false);
      return;
    }
    setProducts((data as Product[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = products.filter((p) =>
    p.product_name.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase()),
  );

  const lowStockCount = products.filter((p) => p.stock_quantity > 0 && p.stock_quantity < 5).length;
  const outOfStockCount = products.filter((p) => p.stock_quantity === 0).length;

  if (showForm || editProduct) {
    return (
      <ProductForm
        product={editProduct}
        onSave={() => { setShowForm(false); setEditProduct(undefined); load(); }}
        onClose={() => { setShowForm(false); setEditProduct(undefined); }}
      />
    );
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="sticky top-0 z-40 pt-4 pb-2 px-4"
        style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-3">
          <h1 className="font-display font-bold text-xl" style={{ color: 'var(--text)' }}>Products</h1>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm transition-all active:scale-95"
            style={{ background: 'var(--accent)', color: 'white' }}>
            <Plus size={16} /> Add
          </button>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text3)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none"
            style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}
          />
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        {(lowStockCount > 0 || outOfStockCount > 0) && (
          <div className="rounded-2xl p-3 flex items-center gap-2"
            style={{ background: 'var(--amber)10', border: '1px solid var(--amber)30' }}>
            <AlertTriangle size={16} style={{ color: 'var(--amber)' }} />
            <p className="text-sm" style={{ color: 'var(--amber)' }}>
              {outOfStockCount > 0 && `${outOfStockCount} out of stock`}
              {outOfStockCount > 0 && lowStockCount > 0 && ' · '}
              {lowStockCount > 0 && `${lowStockCount} low stock`}
            </p>
          </div>
        )}

        <div className="flex gap-3 text-center">
          {[
            { label: 'Total', value: products.length },
            { label: 'In Stock', value: products.filter((p) => p.stock_quantity > 0).length, color: 'var(--emerald)' },
            { label: 'Featured', value: products.filter((p) => p.featured).length, color: 'var(--accent)' },
          ].map((s) => (
            <div key={s.label} className="flex-1 rounded-xl py-2"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p className="font-display font-bold text-lg" style={{ color: s.color || 'var(--text)' }}>{s.value}</p>
              <p className="text-[10px]" style={{ color: 'var(--text3)' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {loadError && (
          <div className="rounded-2xl p-4 flex items-start gap-3"
            style={{ background: 'var(--rose)15', border: '1px solid var(--rose)40' }}>
            <AlertTriangle size={16} style={{ color: 'var(--rose)', flexShrink: 0, marginTop: 2 }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--rose)' }}>Failed to load products</p>
              <p className="text-xs mt-1 font-mono" style={{ color: 'var(--rose)' }}>{loadError}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} style={{ color: 'var(--accent)' }} className="animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Package size={40} style={{ color: 'var(--text3)' }} className="mx-auto mb-3" />
            <p style={{ color: 'var(--text2)' }}>
              {search ? 'No products match your search' : 'No products yet — tap Add to get started'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((p) => (
              <ProductCard
                key={p.product_id}
                product={p}
                onEdit={() => setEditProduct(p)}
                onDelete={() => load()}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
