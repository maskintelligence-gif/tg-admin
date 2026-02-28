import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload, Trash2, X, Check, Camera, Image as ImageIcon,
  Loader2, RefreshCw, CheckSquare, Square, AlertTriangle,
  ZoomIn, ArrowLeft, Grid, List, Plus,
} from 'lucide-react';
import {
  compressImage,
  uploadToMediaLibrary,
  listMediaFiles,
  deleteMediaFiles,
  MediaFile,
} from '../../lib/imageUtils';

// ─── Uploader bar ──────────────────────────────────────────────────────────────

interface UploadJob {
  id: string;
  name: string;
  status: 'compressing' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
  resultUrl?: string;
}

function UploadBar({ jobs }: { jobs: UploadJob[] }) {
  if (!jobs.length) return null;
  const active = jobs.filter((j) => j.status !== 'done' && j.status !== 'error');
  const errors = jobs.filter((j) => j.status === 'error');

  return (
    <div className="mx-4 mb-3 rounded-2xl overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      {/* Active uploads */}
      {active.map((job) => (
        <div key={job.id} className="px-4 py-2.5 flex items-center gap-3"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <Loader2 size={14} className="animate-spin flex-shrink-0" style={{ color: 'var(--accent)' }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs truncate" style={{ color: 'var(--text2)' }}>{job.name}</p>
            <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--border2)' }}>
              <div className="h-full rounded-full transition-all"
                style={{ width: `${job.progress}%`, background: 'var(--accent)' }} />
            </div>
          </div>
          <span className="text-[10px] font-mono flex-shrink-0" style={{ color: 'var(--text3)' }}>
            {job.status === 'compressing' ? 'Compressing…' : `${job.progress}%`}
          </span>
        </div>
      ))}

      {/* Errors */}
      {errors.map((job) => (
        <div key={job.id} className="px-4 py-2.5 flex items-center gap-2">
          <AlertTriangle size={13} style={{ color: 'var(--rose)' }} />
          <p className="text-xs flex-1 truncate" style={{ color: 'var(--rose)' }}>
            {job.name}: {job.error}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({ file, onClose }: { file: MediaFile; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: 'rgba(0,0,0,0.95)' }}
      onClick={onClose}>
      <div className="flex items-center justify-between p-4" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-mono truncate max-w-[70%]" style={{ color: 'var(--text2)' }}>
          {file.name}
        </p>
        <button onClick={onClose} className="p-2 rounded-xl" style={{ background: 'var(--surface)' }}>
          <X size={18} style={{ color: 'var(--text)' }} />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
        <img
          src={file.url}
          alt={file.name}
          className="max-w-full max-h-full object-contain rounded-xl"
          style={{ maxHeight: 'calc(100vh - 120px)' }}
        />
      </div>
      <div className="px-4 pb-6 text-center">
        <p className="text-xs" style={{ color: 'var(--text3)' }}>
          {file.size > 0 ? `${(file.size / 1024).toFixed(0)} KB` : ''}{' '}
          {file.createdAt ? `· ${new Date(file.createdAt).toLocaleDateString()}` : ''}
        </p>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

interface MediaLibraryProps {
  /** When set, the library runs in picker mode — shows a confirm button */
  pickerMode?: boolean;
  /** Max images selectable in picker mode (default unlimited) */
  pickerMax?: number;
  /** Already-selected URLs (picker mode only) */
  initialSelected?: string[];
  onPickerConfirm?: (files: MediaFile[]) => void;
  onPickerCancel?: () => void;
}

export function MediaLibrary({
  pickerMode = false,
  pickerMax,
  initialSelected = [],
  onPickerConfirm,
  onPickerCancel,
}: MediaLibraryProps) {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));
  const [selectMode, setSelectMode] = useState(pickerMode);
  const [uploadJobs, setUploadJobs] = useState<UploadJob[]>([]);
  const [lightbox, setLightbox] = useState<MediaFile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listMediaFiles();
      setFiles(data);
    } catch (err) {
      console.error('Failed to load media:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  // ── Upload a file ──────────────────────────────────────────────────────────
  const processFile = useCallback(async (file: File) => {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const jobName = file.name.slice(0, 30);

    setUploadJobs((prev) => [
      { id: jobId, name: jobName, status: 'compressing', progress: 0 },
      ...prev,
    ]);

    try {
      // Compress
      const blob = await compressImage(file, 1600, 0.85);

      setUploadJobs((prev) =>
        prev.map((j) => j.id === jobId ? { ...j, status: 'uploading', progress: 0 } : j)
      );

      // Upload
      const { url, path } = await uploadToMediaLibrary(blob, (pct) => {
        setUploadJobs((prev) =>
          prev.map((j) => j.id === jobId ? { ...j, progress: pct } : j)
        );
      });

      setUploadJobs((prev) =>
        prev.map((j) => j.id === jobId ? { ...j, status: 'done', progress: 100, resultUrl: url } : j)
      );

      // Refresh grid after short delay (storage may take a moment)
      setTimeout(load, 600);

      // Remove done job after 2s
      setTimeout(() => {
        setUploadJobs((prev) => prev.filter((j) => j.id !== jobId));
      }, 2000);
    } catch (err) {
      setUploadJobs((prev) =>
        prev.map((j) =>
          j.id === jobId ? { ...j, status: 'error', error: (err as Error).message } : j
        )
      );
      // Remove error job after 4s
      setTimeout(() => {
        setUploadJobs((prev) => prev.filter((j) => j.id !== jobId));
      }, 4000);
    }
  }, [load]);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files || []).forEach(processFile);
    e.target.value = '';
  };

  // ── Selection ──────────────────────────────────────────────────────────────
  const toggleSelect = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        if (pickerMode && pickerMax && next.size >= pickerMax) return prev; // enforce max
        next.add(path);
      }
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(files.map((f) => f.path)));
  const clearSelection = () => setSelected(new Set());

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!selected.size) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteMediaFiles([...selected]);
      setSelected(new Set());
      setSelectMode(false);
      await load();
    } catch (err) {
      setDeleteError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  // ── Picker confirm ─────────────────────────────────────────────────────────
  const handlePickerConfirm = () => {
    const picked = files.filter((f) => selected.has(f.path));
    onPickerConfirm?.(picked);
  };

  const activeJobs = uploadJobs.filter((j) => j.status !== 'done');

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="sticky top-0 z-40 px-4 pt-4 pb-3 flex-shrink-0"
        style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>

        {pickerMode ? (
          /* Picker mode header */
          <div className="flex items-center gap-3 mb-3">
            <button onClick={onPickerCancel}
              className="p-2 rounded-xl flex-shrink-0" style={{ background: 'var(--surface2)' }}>
              <ArrowLeft size={18} style={{ color: 'var(--text)' }} />
            </button>
            <div className="flex-1">
              <h2 className="font-display font-bold text-lg" style={{ color: 'var(--text)' }}>
                Pick from Library
              </h2>
              {pickerMax
                ? <p className="text-xs" style={{ color: 'var(--text3)' }}>
                    Select up to {pickerMax} image{pickerMax !== 1 ? 's' : ''}
                  </p>
                : <p className="text-xs" style={{ color: 'var(--text3)' }}>Tap images to select</p>}
            </div>
            {selected.size > 0 && (
              <button onClick={handlePickerConfirm}
                className="px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-1.5 transition-all active:scale-95"
                style={{ background: 'var(--accent)', color: 'white' }}>
                <Check size={15} /> Add {selected.size}
              </button>
            )}
          </div>
        ) : (
          /* Normal mode header */
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="font-display font-bold text-xl" style={{ color: 'var(--text)' }}>Media</h1>
              <p className="text-xs" style={{ color: 'var(--text3)' }}>
                {files.length} image{files.length !== 1 ? 's' : ''} in library
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={load}
                className="p-2 rounded-xl transition-all active:scale-90"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <RefreshCw size={15} style={{ color: 'var(--text2)' }} className={loading ? 'animate-spin' : ''} />
              </button>
              {!selectMode ? (
                <button onClick={() => setSelectMode(true)}
                  className="p-2 rounded-xl transition-all active:scale-90"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <CheckSquare size={15} style={{ color: 'var(--text2)' }} />
                </button>
              ) : (
                <button onClick={() => { setSelectMode(false); clearSelection(); }}
                  className="px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-90"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}

        {/* Selection toolbar */}
        {selectMode && !pickerMode && (
          <div className="flex items-center gap-2">
            <button onClick={selected.size === files.length ? clearSelection : selectAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95"
              style={{ background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border)' }}>
              {selected.size === files.length
                ? <><X size={12} /> Deselect all</>
                : <><CheckSquare size={12} /> Select all</>}
            </button>
            <span className="text-xs" style={{ color: 'var(--text3)' }}>
              {selected.size} selected
            </span>
            {selected.size > 0 && (
              <button onClick={handleDelete} disabled={deleting}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95"
                style={{ background: 'var(--rose)', color: 'white', opacity: deleting ? 0.7 : 1 }}>
                {deleting
                  ? <><Loader2 size={12} className="animate-spin" /> Deleting…</>
                  : <><Trash2 size={12} /> Delete {selected.size}</>}
              </button>
            )}
          </div>
        )}

        {/* Picker selection count */}
        {pickerMode && selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--text3)' }}>
              {selected.size} selected
            </span>
            <button onClick={clearSelection}
              className="text-xs flex items-center gap-1" style={{ color: 'var(--rose)' }}>
              <X size={11} /> Clear
            </button>
          </div>
        )}
      </div>

      {/* Upload progress */}
      {activeJobs.length > 0 && (
        <div className="pt-3">
          <UploadBar jobs={activeJobs} />
        </div>
      )}

      {/* Delete error */}
      {deleteError && (
        <div className="mx-4 mt-2 p-3 rounded-xl flex items-center gap-2"
          style={{ background: 'var(--rose)15', border: '1px solid var(--rose)40' }}>
          <AlertTriangle size={14} style={{ color: 'var(--rose)' }} />
          <p className="text-xs" style={{ color: 'var(--rose)' }}>{deleteError}</p>
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-3 py-3 pb-6">
        {loading && !files.length ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} style={{ color: 'var(--accent)' }} className="animate-spin" />
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'var(--surface2)' }}>
              <ImageIcon size={32} style={{ color: 'var(--text3)' }} />
            </div>
            <p className="font-semibold mb-1" style={{ color: 'var(--text)' }}>No images yet</p>
            <p className="text-sm" style={{ color: 'var(--text3)' }}>
              Upload images from your camera or gallery to build your media library
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {files.map((file) => {
              const isSelected = selected.has(file.path);
              const inSelectMode = selectMode || pickerMode;

              return (
                <div key={file.path} className="relative aspect-square rounded-xl overflow-hidden"
                  style={{
                    border: `2px solid ${isSelected ? 'var(--accent)' : 'transparent'}`,
                    background: 'var(--surface2)',
                  }}>
                  <img
                    src={file.url}
                    alt={file.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />

                  {/* Tap target */}
                  <button
                    className="absolute inset-0"
                    onClick={() => {
                      if (inSelectMode) {
                        toggleSelect(file.path);
                      } else {
                        setLightbox(file);
                      }
                    }}
                  />

                  {/* Selection checkbox */}
                  {inSelectMode && (
                    <div className="absolute top-1.5 left-1.5 pointer-events-none">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center"
                        style={{
                          background: isSelected ? 'var(--accent)' : 'rgba(0,0,0,0.5)',
                          border: `2px solid ${isSelected ? 'var(--accent)' : 'rgba(255,255,255,0.6)'}`,
                        }}>
                        {isSelected && <Check size={11} color="white" strokeWidth={3} />}
                      </div>
                    </div>
                  )}

                  {/* Selection overlay */}
                  {isSelected && (
                    <div className="absolute inset-0 pointer-events-none"
                      style={{ background: 'rgba(37,99,235,0.2)' }} />
                  )}

                  {/* Zoom hint (non-select mode) */}
                  {!inSelectMode && (
                    <button
                      className="absolute bottom-1 right-1 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: 'rgba(0,0,0,0.5)' }}
                      onClick={(e) => { e.stopPropagation(); setLightbox(file); }}>
                      <ZoomIn size={12} color="white" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload FAB (normal mode only) */}
      {!pickerMode && (
        <div className="fixed bottom-20 right-4 flex flex-col items-end gap-2 z-40">
          {/* Camera */}
          <button onClick={() => cameraRef.current?.click()}
            className="flex items-center gap-2 px-4 py-3 rounded-2xl font-bold text-sm shadow-lg transition-all active:scale-95"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
            <Camera size={16} style={{ color: 'var(--accent)' }} /> Camera
          </button>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment"
            multiple className="hidden" onChange={handleFiles} />

          {/* Gallery */}
          <button onClick={() => galleryRef.current?.click()}
            className="flex items-center gap-2 px-4 py-3 rounded-2xl font-bold text-sm shadow-lg transition-all active:scale-95"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
            <ImageIcon size={16} style={{ color: 'var(--purple)' }} /> Gallery
          </button>
          <input ref={galleryRef} type="file" accept="image/*" multiple
            className="hidden" onChange={handleFiles} />

          {/* Main FAB */}
          <button onClick={() => galleryRef.current?.click()}
            className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl transition-all active:scale-90"
            style={{ background: 'var(--accent)', boxShadow: '0 4px 24px var(--accent-glow)' }}>
            <Plus size={24} color="white" />
          </button>
        </div>
      )}

      {/* Upload buttons in picker mode (let them add new images while picking) */}
      {pickerMode && (
        <div className="px-4 py-3 flex gap-2 flex-shrink-0"
          style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
          <button onClick={() => cameraRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
            <Camera size={15} style={{ color: 'var(--accent)' }} /> Camera
          </button>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment"
            multiple className="hidden" onChange={handleFiles} />

          <button onClick={() => galleryRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
            <ImageIcon size={15} style={{ color: 'var(--purple)' }} /> Upload
          </button>
          <input ref={galleryRef} type="file" accept="image/*" multiple
            className="hidden" onChange={handleFiles} />
        </div>
      )}

      {/* Lightbox */}
      {lightbox && <Lightbox file={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}
