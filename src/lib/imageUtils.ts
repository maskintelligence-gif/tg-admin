import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ImageStatus = 'idle' | 'compressing' | 'uploading' | 'done' | 'error';

export interface ImageItem {
  /** Stable local ID — never changes across re-renders */
  localId: string;
  /** Final public URL — populated after upload or immediately for pasted URLs */
  url: string;
  /** Blob URL for instant preview while uploading, same as url for pasted URLs */
  preview: string;
  source: 'camera' | 'gallery' | 'url';
  status: ImageStatus;
  /** 0–100 upload progress */
  progress: number;
  /** Supabase Storage path (bucket-relative) — used for deletions */
  storagePath?: string;
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function makeLocalId(): string {
  return `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Image compression via Canvas ─────────────────────────────────────────────

/**
 * Compress a File to JPEG using the Canvas API.
 * Targets ≤ maxWidth and the given quality factor.
 * Converts PNG transparency to white background (safe for JPEG).
 */
export async function compressImage(
  file: File,
  maxWidth = 1200,
  quality = 0.82,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      try {
        const scale = Math.min(1, maxWidth / img.naturalWidth);
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D unavailable');

        // White background for PNG → JPEG conversion
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('canvas.toBlob returned null'));
          },
          'image/jpeg',
          quality,
        );
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to decode image'));
    };

    img.src = objectUrl;
  });
}

// ─── Supabase Storage upload with progress ────────────────────────────────────

const BUCKET = 'product-images';

/**
 * Upload a Blob to Supabase Storage.
 * Uses XMLHttpRequest so we can report progress.
 * Returns the public URL and bucket-relative path.
 */
export async function uploadToStorage(
  blob: Blob,
  productId: string,
  onProgress?: (pct: number) => void,
): Promise<{ url: string; path: string }> {
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const path = `products/${productId}/${filename}`;

  // Pull the project URL and service role key out of the supabase client.
  // createClient stores them on the instance — we reach in carefully.
  const clientAny = supabase as any;
  const supabaseUrl: string =
    clientAny.supabaseUrl ??
    clientAny.rest?.url?.replace('/rest/v1', '') ??
    '';
  const apiKey: string =
    clientAny.supabaseKey ??
    clientAny.rest?.headers?.['apikey'] ??
    '';

  if (!supabaseUrl || !apiKey) {
    throw new Error('Could not read Supabase URL/key from client. Check lib/supabase.ts');
  }

  const uploadUrl = `${supabaseUrl}/storage/v1/object/${BUCKET}/${path}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 95)); // cap at 95 until confirmed
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
      } else {
        let msg = `Upload failed (${xhr.status})`;
        try {
          const body = JSON.parse(xhr.responseText);
          if (body.error) msg = body.error;
          else if (body.message) msg = body.message;
        } catch {}
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => reject(new Error('Network error — check your connection'));
    xhr.ontimeout = () => reject(new Error('Upload timed out'));

    xhr.open('POST', uploadUrl);
    xhr.timeout = 60_000; // 60s
    xhr.setRequestHeader('apikey', apiKey);
    xhr.setRequestHeader('authorization', `Bearer ${apiKey}`);
    xhr.setRequestHeader('content-type', 'image/jpeg');
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.send(blob);
  });

  // Get the public URL (no auth needed — bucket is public)
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return { url: data.publicUrl, path };
}

// ─── Delete from Storage ──────────────────────────────────────────────────────

/**
 * Remove an image from Supabase Storage.
 * Fails silently — deletion is best-effort (image may already be gone).
 */
export async function deleteFromStorage(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) console.warn('[imageUtils] delete failed:', error.message);
}


// ─── Media Library helpers ────────────────────────────────────────────────────

export const MEDIA_BUCKET = 'media-library';

export interface MediaFile {
  /** Full public URL */
  url: string;
  /** Bucket-relative path — used for deletions */
  path: string;
  /** File name */
  name: string;
  /** Size in bytes */
  size: number;
  /** ISO date string */
  createdAt: string;
}

/**
 * List all files in the media-library bucket.
 * Returns newest first.
 */
export async function listMediaFiles(): Promise<MediaFile[]> {
  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .list('', {
      limit: 500,
      sortBy: { column: 'created_at', order: 'desc' },
    });

  if (error) throw new Error(error.message);
  if (!data) return [];

  return data
    .filter((f) => f.name !== '.emptyFolderPlaceholder')
    .map((f) => {
      const { data: urlData } = supabase.storage
        .from(MEDIA_BUCKET)
        .getPublicUrl(f.name);
      return {
        url: urlData.publicUrl,
        path: f.name,
        name: f.name,
        size: f.metadata?.size ?? 0,
        createdAt: f.created_at ?? '',
      };
    });
}

/**
 * Upload a Blob to the media-library bucket with XHR progress.
 */
export async function uploadToMediaLibrary(
  blob: Blob,
  onProgress?: (pct: number) => void,
): Promise<{ url: string; path: string }> {
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;

  const clientAny = supabase as any;
  const supabaseUrl: string =
    clientAny.supabaseUrl ??
    clientAny.rest?.url?.replace('/rest/v1', '') ??
    '';
  const apiKey: string =
    clientAny.supabaseKey ??
    clientAny.rest?.headers?.['apikey'] ??
    '';

  if (!supabaseUrl || !apiKey) {
    throw new Error('Cannot read Supabase URL/key — check lib/supabase.ts');
  }

  const uploadUrl = `${supabaseUrl}/storage/v1/object/${MEDIA_BUCKET}/${filename}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 95));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { onProgress?.(100); resolve(); }
      else {
        let msg = `Upload failed (${xhr.status})`;
        try { const b = JSON.parse(xhr.responseText); if (b.error) msg = b.error; } catch {}
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.ontimeout = () => reject(new Error('Upload timed out'));
    xhr.open('POST', uploadUrl);
    xhr.timeout = 90_000;
    xhr.setRequestHeader('apikey', apiKey);
    xhr.setRequestHeader('authorization', `Bearer ${apiKey}`);
    xhr.setRequestHeader('content-type', 'image/jpeg');
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.send(blob);
  });

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(filename);
  return { url: data.publicUrl, path: filename };
}

/**
 * Delete one or more files from the media-library bucket.
 */
export async function deleteMediaFiles(paths: string[]): Promise<void> {
  if (!paths.length) return;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).remove(paths);
  if (error) throw new Error(error.message);
}
