// ---------------------------------------------------------------------
// Backfill: generates -sm (480px) / -md (900px) responsive variants for
// product/review images uploaded BEFORE the responsive-images feature
// shipped. New uploads already get all 3 sizes automatically (see
// app/api/upload-image/route.ts and app/api/admin/import-image/route.ts).
//
// SAFETY GUARANTEES
//   - 100% additive. This only ever ADDS new files (name-sm.ext,
//     name-md.ext) next to the existing original. The original file is
//     never opened for writing, renamed, or deleted by this process.
//   - No database row and no product/media URL is ever touched. Every
//     image keeps serving from the exact same /media/... URL it always
//     has, whether this has run or not.
//   - Idempotent: builds one file listing per run and skips any image
//     that already has both variants (from a previous run, or because
//     it was uploaded after the feature shipped and got them
//     automatically). Safe to start/reset/re-run any time.
//   - Even if this backfill is NEVER run, nothing breaks: the /media/
//     proxy (app/media/[...path]/route.ts) automatically falls back to
//     the original file whenever a -sm/-md variant is requested but
//     doesn't exist yet — so the Responsive Images toggle above is safe
//     to turn on before, during, or after this finishes.
// ---------------------------------------------------------------------

import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { uploadToStorage, type StorageBucket } from '@/lib/storage';
import { generateResponsiveSizes } from '@/lib/image-sizes';

const IMAGE_BUCKETS: StorageBucket[] = ['product-images', 'review-images'];
const BATCH_SIZE = 8; // sharp resizing is CPU-heavier than a plain copy — keep batches small
const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif']);

export interface ResizeQueueItem {
  bucket: StorageBucket;
  path: string; // path of the ORIGINAL file (never a -sm/-md path)
}

export interface ResizeBackfillProgress {
  status: 'idle' | 'running' | 'done' | 'error';
  total: number;
  processed: number;
  generated: number; // variant files newly created this run
  alreadyDone: number; // originals that already had both variants (found during "start")
  failed: number;
  queue: ResizeQueueItem[];
  recentErrors: { bucket: string; path: string; error: string }[];
  startedAt: string | null;
  updatedAt: string | null;
  finishedAt: string | null;
}

const DEFAULT_PROGRESS: ResizeBackfillProgress = {
  status: 'idle',
  total: 0,
  processed: 0,
  generated: 0,
  alreadyDone: 0,
  failed: 0,
  queue: [],
  recentErrors: [],
  startedAt: null,
  updatedAt: null,
  finishedAt: null,
};

const SETTINGS_KEY = 'image_resize_backfill_progress';

export async function fetchResizeBackfillProgress(): Promise<ResizeBackfillProgress> {
  const admin = getSupabaseAdmin();
  const { data } = await admin.from('settings').select('value').eq('key', SETTINGS_KEY).maybeSingle();
  if (!data?.value) return DEFAULT_PROGRESS;
  return { ...DEFAULT_PROGRESS, ...(data.value as Partial<ResizeBackfillProgress>) };
}

async function saveProgress(progress: ResizeBackfillProgress): Promise<void> {
  const admin = getSupabaseAdmin();
  await admin
    .from('settings')
    .upsert({ key: SETTINGS_KEY, value: { ...progress, updatedAt: new Date().toISOString() } }, { onConflict: 'key' });
}

function splitExt(path: string): { base: string; ext: string } | null {
  const dot = path.lastIndexOf('.');
  if (dot === -1) return null;
  return { base: path.slice(0, dot), ext: path.slice(dot + 1).toLowerCase() };
}

function isVariant(path: string): boolean {
  const parts = splitExt(path);
  if (!parts) return false;
  return parts.base.endsWith('-sm') || parts.base.endsWith('-md');
}

/**
 * Recursively lists every file (not folder) in a Supabase storage bucket,
 * read-only. Same approach as lib/media-backfill.ts.
 */
async function listAllFiles(bucket: StorageBucket, prefix = ''): Promise<string[]> {
  const admin = getSupabaseAdmin();
  const paths: string[] = [];
  let offset = 0;
  const pageSize = 100;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await admin.storage
      .from(bucket)
      .list(prefix, { limit: pageSize, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error || !data) break;

    for (const entry of data) {
      const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null && !entry.metadata) {
        const nested = await listAllFiles(bucket, fullPath);
        paths.push(...nested);
      } else {
        paths.push(fullPath);
      }
    }

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return paths;
}

/**
 * Step 1: list every image file in Supabase (source of truth) across the
 * image buckets, and build a queue of originals that are missing one or
 * both variants. Resets any previous run's progress.
 */
export async function startResizeBackfill(): Promise<ResizeBackfillProgress> {
  const queue: ResizeQueueItem[] = [];
  let alreadyDone = 0;

  for (const bucket of IMAGE_BUCKETS) {
    const allPaths = await listAllFiles(bucket);
    const existing = new Set(allPaths);

    for (const path of allPaths) {
      if (isVariant(path)) continue; // never try to resize a -sm/-md file itself
      const parts = splitExt(path);
      if (!parts || !IMAGE_EXT.has(parts.ext)) continue; // skip non-images / no extension

      const smPath = `${parts.base}-sm.${parts.ext}`;
      const mdPath = `${parts.base}-md.${parts.ext}`;
      if (existing.has(smPath) && existing.has(mdPath)) {
        alreadyDone += 1;
        continue; // already backfilled
      }

      queue.push({ bucket, path });
    }
  }

  const progress: ResizeBackfillProgress = {
    ...DEFAULT_PROGRESS,
    status: queue.length === 0 ? 'done' : 'running',
    total: queue.length,
    alreadyDone,
    queue,
    startedAt: new Date().toISOString(),
    finishedAt: queue.length === 0 ? new Date().toISOString() : null,
  };
  await saveProgress(progress);
  return progress;
}

/**
 * Step 2: process the next batch. Call repeatedly (the admin panel polls
 * this) until status becomes 'done'. For each original: download its
 * bytes from Supabase (read-only), generate the missing -sm/-md sizes,
 * and dual-write them (Supabase + R2 mirror) via the same uploadToStorage()
 * every other upload path uses.
 */
export async function runResizeBackfillBatch(): Promise<ResizeBackfillProgress> {
  const progress = await fetchResizeBackfillProgress();
  if (progress.status !== 'running' || progress.queue.length === 0) {
    return progress;
  }

  const admin = getSupabaseAdmin();
  const batch = progress.queue.slice(0, BATCH_SIZE);
  const remaining = progress.queue.slice(BATCH_SIZE);

  for (const item of batch) {
    try {
      const parts = splitExt(item.path);
      if (!parts) throw new Error('Could not determine file extension');

      const { data: blob, error: downloadError } = await admin.storage.from(item.bucket).download(item.path);
      if (downloadError || !blob) throw downloadError || new Error('Empty download from Supabase');

      const buffer = Buffer.from(await blob.arrayBuffer());
      const sizes = await generateResponsiveSizes(buffer);
      // generateResponsiveSizes also returns the "original" (1600px,
      // suffix '') entry — skip it, the real original already exists
      // at item.path and must never be touched or overwritten.
      const smAndMd = sizes.filter((s) => s.suffix === '-sm' || s.suffix === '-md');

      for (const size of smAndMd) {
        const variantPath = `${parts.base}${size.suffix}.${parts.ext}`;
        try {
          await uploadToStorage({
            bucket: item.bucket,
            path: variantPath,
            buffer: size.buffer,
            contentType: size.contentType,
          });
          progress.generated += 1;
        } catch (uploadErr) {
          // "already exists" (upsert: false) just means a previous
          // partial run — or a race with a fresh upload — got there
          // first. That's fine, not a real failure. Anything else is.
          const msg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
          if (!/exist/i.test(msg)) throw uploadErr;
        }
      }
    } catch (err) {
      progress.failed += 1;
      progress.recentErrors = [
        { bucket: item.bucket, path: item.path, error: err instanceof Error ? err.message : 'Unknown error' },
        ...progress.recentErrors,
      ].slice(0, 20);
    }
    progress.processed += 1;
  }

  progress.queue = remaining;
  if (remaining.length === 0) {
    progress.status = 'done';
    progress.finishedAt = new Date().toISOString();
  }

  await saveProgress(progress);
  return progress;
}

export async function resetResizeBackfillProgress(): Promise<ResizeBackfillProgress> {
  await saveProgress(DEFAULT_PROGRESS);
  return DEFAULT_PROGRESS;
}
