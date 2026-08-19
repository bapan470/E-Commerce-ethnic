// ---------------------------------------------------------------------
// Unified media storage layer -- Supabase Storage OR Cloudflare R2.
//
// WHY THIS FILE EXISTS
// Vercel Hobby + Supabase free tier both meter bandwidth/egress. Once
// product photos and videos push past those free quotas, images start
// failing to load on the live site. Cloudflare R2 has ZERO egress fees,
// so moving media there removes that ceiling without touching anything
// else about how the site works.
//
// HOW THE SWITCH WORKS (1-click rollback, no data loss)
// Set STORAGE_PROVIDER=r2 in Vercel env vars -> every NEW upload goes to
// R2. Set it back to STORAGE_PROVIDER=supabase (or just delete the var)
// -> uploads go back to Supabase Storage exactly like before. Old files
// already sitting in Supabase are NEVER deleted or moved by this file --
// they keep serving from their existing supabase.co URLs forever, so
// nothing on the live storefront, Google Merchant feed, Meta/Pinterest
// catalog, or sitemap breaks when you flip this.
//
// Migrating the ~500 already-uploaded images/videos to R2 too (so they
// also stop counting against Supabase egress) is a separate, optional
// step -- see scripts/migrate-to-r2.mjs. That script COPIES files to R2
// and leaves the Supabase originals untouched, so it's reversible too.
// ---------------------------------------------------------------------

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export type StorageBucket = 'product-images' | 'product-videos';

const PROVIDER = (process.env.STORAGE_PROVIDER || 'supabase').toLowerCase();

let r2Client: S3Client | null = null;

function getR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'STORAGE_PROVIDER=r2 but R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY are missing. ' +
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

function r2PublicUrl(bucket: StorageBucket, path: string): string {
  const base = process.env.R2_PUBLIC_URL; // e.g. https://cdn.yourdomain.com
  if (!base) {
    throw new Error('R2_PUBLIC_URL is not set (your R2 bucket custom domain, e.g. https://cdn.yourdomain.com).');
  }
  return `${base.replace(/\/$/, '')}/${bucket}/${path}`;
}

/**
 * Uploads a file to whichever provider is active and returns its public
 * URL. Callers (upload-image, import-image, upload-video,
 * product-video/upload) don't need to know which backend is in use.
 */
export async function uploadToStorage(params: {
  bucket: StorageBucket;
  path: string;
  buffer: Buffer;
  contentType: string;
}): Promise<{ url: string }> {
  const { bucket, path, buffer, contentType } = params;

  if (PROVIDER === 'r2') {
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
    return { url: r2PublicUrl(bucket, path) };
  }

  // Default / fallback: Supabase Storage (unchanged original behavior)
  const admin = getSupabaseAdmin();
  const { error } = await admin.storage.from(bucket).upload(path, buffer, {
    cacheControl: '31536000',
    upsert: false,
    contentType,
  });
  if (error) throw error;
  const { data } = admin.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl };
}

/** Deletes a file from whichever provider is active. Used by admin tools
 * that replace/clean up a file (e.g. the WebP re-encode route). */
export async function deleteFromStorage(params: { bucket: StorageBucket; path: string }): Promise<void> {
  const { bucket, path } = params;
  if (PROVIDER === 'r2') {
    const client = getR2Client();
    await client.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: `${bucket}/${path}` }));
    return;
  }
  const admin = getSupabaseAdmin();
  await admin.storage.from(bucket).remove([path]);
}

export function activeStorageProvider(): 'r2' | 'supabase' {
  return PROVIDER === 'r2' ? 'r2' : 'supabase';
}

/**
 * For large files (product videos) we upload DIRECTLY from the browser
 * to storage instead of through the Vercel function body (which has a
 * hard ~4.5MB limit on every plan). This mints a short-lived write
 * credential for whichever provider is active:
 *  - supabase: a Supabase "signed upload URL" token, consumed client-side
 *    via supabase.storage.from(bucket).uploadToSignedUrl(path, token, file)
 *  - r2: a presigned S3 PUT URL, consumed client-side via a plain
 *    `fetch(uploadUrl, { method: 'PUT', body: file })`
 */
export async function createDirectUploadTarget(params: {
  bucket: StorageBucket;
  path: string;
  contentType: string;
}): Promise<
  | { provider: 'supabase'; path: string; token: string; url: string }
  | { provider: 'r2'; path: string; uploadUrl: string; url: string }
> {
  const { bucket, path, contentType } = params;

  if (PROVIDER === 'r2') {
    const client = getR2Client();
    const key = `${bucket}/${path}`;
    const uploadUrl = await getSignedUrl(
      client,
      new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key, ContentType: contentType }),
      { expiresIn: 300 } // 5 minutes, plenty for an admin to start the upload
    );
    return { provider: 'r2', path, uploadUrl, url: r2PublicUrl(bucket, path) };
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) throw error || new Error('Could not create signed upload URL.');
  const { data: publicUrlData } = admin.storage.from(bucket).getPublicUrl(path);
  return { provider: 'supabase', path: data.path, token: data.token, url: publicUrlData.publicUrl };
}
