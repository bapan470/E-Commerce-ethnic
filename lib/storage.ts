// ---------------------------------------------------------------------
// Unified media storage layer — DUAL-WRITE (Supabase + Cloudflare R2).
//
// WHY THIS FILE CHANGED (from single-backend STORAGE_PROVIDER switch)
// Previously this file had a STORAGE_PROVIDER env-var switch that sent
// uploads to *either* Supabase *or* R2. That had two problems:
//   1. Any image uploaded while STORAGE_PROVIDER=r2 would break if R2
//      credentials were ever removed — there was no Supabase copy.
//   2. r2PublicUrl() returned a raw cdn.aruhihandlooms.com URL, which
//      bypassed toPublicMediaUrl() and the /media/ proxy entirely —
//      meaning a raw storage host was exposed in the DB and on the
//      storefront (confirmed bug from MIGRATION_AUDIT_V2.md).
//
// DUAL-WRITE DESIGN
//   • Every new upload goes to BOTH Supabase (required, source of truth)
//     AND Cloudflare R2 (best-effort mirror).
//   • If Supabase upload fails → the whole upload fails (same as before).
//   • If R2 upload fails → logged, never thrown, upload still succeeds.
//   • The canonical URL returned/stored is ALWAYS aruhihandlooms.com/media/
//     — never a raw supabase.co or cdn.aruhihandlooms.com URL.
//   • Serving which backend to try first is controlled by the admin toggle
//     (media_storage_backend DB setting) — that's all the toggle does now.
//     Uploads always go to both regardless.
//
// BACKWARD COMPATIBILITY
//   • ~500 pre-existing rows in the DB that have raw Supabase URLs are
//     handled by toPublicMediaUrl() in lib/media-url.ts (unchanged —
//     it already converts them to /media/ on read).
//   • No existing row is touched by this change.
// ---------------------------------------------------------------------

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export type StorageBucket = 'product-images' | 'product-videos' | 'review-images';

// Canonical public base — the only host that should ever appear in the DB
// or be returned to callers. Never expose supabase.co or cdn.* directly.
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.aruhihandlooms.com').replace(/\/$/, '');

let r2Client: S3Client | null = null;

export function r2EnvPresent(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME &&
    process.env.R2_PUBLIC_URL
  );
}

function getR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'R2 env vars missing: R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY. ' +
        'Add them in Vercel Project Settings -> Environment Variables.'
    );
  }

  if (!r2Client) {
    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return r2Client;
}

/**
 * Builds the canonical /media/ URL for any bucket+path combination.
 * This is the ONLY form that should ever be stored in the database or
 * returned to callers — never the raw Supabase or R2 CDN URL.
 */
export function canonicalMediaUrl(bucket: StorageBucket, path: string): string {
  return `${SITE_URL}/media/${bucket}/${path}`;
}

/**
 * Uploads a file to Supabase (required) and mirrors it to R2 (best-effort).
 * Always returns a canonical aruhihandlooms.com/media/... URL — never a
 * raw storage host URL.
 *
 * @returns { url, r2Mirrored } — url is always the canonical /media/ URL;
 *   r2Mirrored tells callers whether the R2 copy succeeded (useful for
 *   logging; not needed for correctness — the proxy handles fallback).
 */
export async function uploadToStorage(params: {
  bucket: StorageBucket;
  path: string;
  buffer: Buffer;
  contentType: string;
}): Promise<{ url: string; r2Mirrored: boolean }> {
  const { bucket, path, buffer, contentType } = params;

  // --- Step 1: Supabase upload (REQUIRED — failure throws to the caller) ---
  const admin = getSupabaseAdmin();
  const { error: supabaseError } = await admin.storage.from(bucket).upload(path, buffer, {
    cacheControl: '31536000',
    upsert: false,
    contentType,
  });
  if (supabaseError) throw supabaseError;

  // --- Step 2: R2 mirror upload (BEST-EFFORT — failure is logged, never thrown) ---
  let r2Mirrored = false;
  if (r2EnvPresent()) {
    try {
      const client = getR2Client();
      const key = `${bucket}/${path}`; // one R2 bucket, folder-per-Supabase-bucket
      await client.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000, immutable',
        })
      );
      r2Mirrored = true;
    } catch (r2Err) {
      // Best-effort: log but NEVER throw. The Supabase copy is the source
      // of truth and the /media/ proxy will fall back to it automatically.
      console.error('[storage] R2 mirror upload failed (non-blocking):', r2Err);
    }
  }

  // Always return the canonical /media/ URL — never a raw storage host.
  return { url: canonicalMediaUrl(bucket, path), r2Mirrored };
}

/**
 * Deletes a file from both Supabase and R2 (best-effort on each).
 * One failure never blocks the other — both deletes are always attempted.
 */
export async function deleteFromStorage(params: { bucket: StorageBucket; path: string }): Promise<void> {
  const { bucket, path } = params;

  // Delete from Supabase (best-effort — don't let it block R2 delete)
  try {
    const admin = getSupabaseAdmin();
    await admin.storage.from(bucket).remove([path]);
  } catch (err) {
    console.error('[storage] Supabase delete failed (non-blocking):', err);
  }

  // Delete from R2 (best-effort)
  if (r2EnvPresent()) {
    try {
      const client = getR2Client();
      await client.send(
        new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: `${bucket}/${path}` })
      );
    } catch (err) {
      console.error('[storage] R2 delete failed (non-blocking):', err);
    }
  }
}

/**
 * For large files (product videos) we upload DIRECTLY from the browser
 * to storage instead of through the Vercel function body (4.5MB limit).
 * This mints a short-lived write credential for Supabase (source of truth).
 * Note: Direct R2 mirror is NOT done here because the browser uploads
 * directly to Supabase — a server-side R2 mirror for direct uploads
 * would require a separate post-upload webhook, which is out of scope.
 * Videos are large enough that Supabase-only for direct uploads is fine.
 */
export async function createDirectUploadTarget(params: {
  bucket: StorageBucket;
  path: string;
  contentType: string;
}): Promise<{ provider: 'supabase'; path: string; token: string; url: string }> {
  const { bucket, path } = params;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) throw error || new Error('Could not create signed upload URL.');
  // Return canonical /media/ URL — not the raw Supabase URL
  return { provider: 'supabase', path: data.path, token: data.token, url: canonicalMediaUrl(bucket, path) };
}

/**
 * For admin tools that need a presigned R2 URL directly (e.g. WebP
 * re-encode replace flows). Only available when R2 env vars are present.
 */
export async function createR2PresignedUpload(params: {
  bucket: StorageBucket;
  path: string;
  contentType: string;
}): Promise<{ uploadUrl: string; url: string }> {
  if (!r2EnvPresent()) {
    throw new Error('R2 env vars are not configured — cannot create R2 presigned URL.');
  }
  const { bucket, path, contentType } = params;
  const client = getR2Client();
  const key = `${bucket}/${path}`;
  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key, ContentType: contentType }),
    { expiresIn: 300 }
  );
  return { uploadUrl, url: canonicalMediaUrl(bucket, path) };
}

// Kept for any code that still calls activeStorageProvider() —
// returns 'supabase' always since we now always write to both.
// @deprecated — dual-write makes this concept meaningless; will be removed.
export function activeStorageProvider(): 'r2' | 'supabase' {
  return 'supabase';
}
