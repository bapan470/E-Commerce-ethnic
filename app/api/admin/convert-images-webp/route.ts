import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import sharp from 'sharp';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// ---------------------------------------------------------------------
// One-click "Convert all images to WebP" tool for the admin Settings
// page. Older uploads (from before the sharp/Node-version fix) are
// sitting in Supabase Storage as .jpg/.jpeg/.png. This route re-encodes
// them to real WebP, gives them a descriptive SEO-friendly filename
// (product-name / variant-color slug instead of a bare random hash --
// this is the actual lever for image SEO; the on-page `alt` text is
// already generated dynamically per image from the product's name,
// fabric, category and angle at render time -- see
// components/product/product-gallery.tsx and components/product-card.tsx
// -- so there's no separate per-image alt text stored in the database
// to "fix"), updates the DB row, and deletes the old file.
//
// Called repeatedly by the admin UI (components/admin/settings-panel.tsx)
// in a client-side loop, one small batch per request, so:
//   1. it stays comfortably under the serverless function time limit, and
//   2. the UI can show a live "X converted / Y skipped / Z remaining"
//      counter instead of one opaque spinner.
//
// The client passes back the URLs it has already attempted (both
// converted and failed) via `excludeUrls` so a batch never re-picks an
// image that already failed in this run -- that's what guarantees the
// loop terminates instead of retrying a permanently-broken image forever.
// ---------------------------------------------------------------------

export const maxDuration = 60;

const BATCH_SIZE = 8;
const WEBP_QUALITY = 82;
const MAX_BYTES = 15 * 1024 * 1024;
const BUCKET = 'product-images';
const BUCKET_MARKER = `/storage/v1/object/public/${BUCKET}/`;

type Candidate = {
  table: 'products' | 'product_variants';
  id: string;
  index: number;
  url: string;
  path: string; // storage path within the bucket, e.g. "variants/167...-abc.jpg"
  slugSource: string; // for building the new SEO filename
};

function isWebp(url: string): boolean {
  return /\.webp(\?|$)/i.test(url);
}

function storagePathFromUrl(url: string): string | null {
  const at = url.indexOf(BUCKET_MARKER);
  if (at === -1) return null;
  const rawPath = url.slice(at + BUCKET_MARKER.length).split('?')[0];
  try {
    return decodeURIComponent(rawPath);
  } catch {
    return rawPath;
  }
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export async function POST(req: Request) {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const verified = await verifyAdminToken(cookie);
  if (!verified.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const excludeUrls = new Set<string>(Array.isArray(body?.excludeUrls) ? body.excludeUrls : []);

  const admin = getSupabaseAdmin();

  const [{ data: products, error: productsErr }, { data: variants, error: variantsErr }] = await Promise.all([
    admin.from('products').select('id, name, images'),
    admin.from('product_variants').select('id, color, images'),
  ]);

  if (productsErr || variantsErr) {
    return NextResponse.json(
      { error: (productsErr || variantsErr)?.message || 'Could not read products/variants.' },
      { status: 500 }
    );
  }

  // Build the full "still needs converting" candidate list, minus anything
  // this run has already attempted (success or failure).
  const candidates: Candidate[] = [];

  for (const row of products ?? []) {
    const images: string[] = row.images ?? [];
    images.forEach((url, index) => {
      if (!url || isWebp(url) || excludeUrls.has(url)) return;
      const path = storagePathFromUrl(url);
      if (!path) return; // not one of our own storage files -- leave untouched
      candidates.push({ table: 'products', id: row.id, index, url, path, slugSource: row.name || 'product' });
    });
  }

  for (const row of variants ?? []) {
    const images: string[] = row.images ?? [];
    images.forEach((url, index) => {
      if (!url || isWebp(url) || excludeUrls.has(url)) return;
      const path = storagePathFromUrl(url);
      if (!path) return;
      candidates.push({
        table: 'product_variants',
        id: row.id,
        index,
        url,
        path,
        slugSource: row.color || 'variant',
      });
    });
  }

  const totalRemaining = candidates.length;
  const batch = candidates.slice(0, BATCH_SIZE);

  let converted = 0;
  let skipped = 0;
  const attempted: string[] = [];

  // Group the batch by row so each row only gets ONE update() call even if
  // it has multiple images being converted in this batch.
  const byRow = new Map<string, { table: Candidate['table']; id: string; images: string[]; edits: Map<number, string> }>();

  for (const c of batch) {
    attempted.push(c.url);
    try {
      const sourceRes = await fetch(c.url);
      if (!sourceRes.ok) throw new Error(`source fetch ${sourceRes.status}`);
      const arrayBuffer = await sourceRes.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_BYTES) throw new Error('source too large');

      const webpBuffer = await sharp(Buffer.from(arrayBuffer), { failOn: 'none' })
        .rotate()
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();

      const folder = c.path.startsWith('variants/') ? 'variants' : 'products';
      const slug = slugify(c.slugSource);
      const newPath = `${folder}/${slug ? `${slug}-` : ''}${Date.now()}-${Math.random().toString(36).slice(2, 9)}.webp`;

      const { error: uploadErr } = await admin.storage.from(BUCKET).upload(newPath, webpBuffer, {
        cacheControl: '31536000',
        upsert: false,
        contentType: 'image/webp',
      });
      if (uploadErr) throw new Error(uploadErr.message);

      const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(newPath);
      const newUrl = pub.publicUrl;

      const rowKey = `${c.table}:${c.id}`;
      if (!byRow.has(rowKey)) {
        const sourceRow =
          c.table === 'products'
            ? (products ?? []).find((r) => r.id === c.id)
            : (variants ?? []).find((r) => r.id === c.id);
        byRow.set(rowKey, {
          table: c.table,
          id: c.id,
          images: [...((sourceRow?.images as string[]) ?? [])],
          edits: new Map(),
        });
      }
      byRow.get(rowKey)!.edits.set(c.index, newUrl);

      // Best-effort cleanup of the old file. Never lets a delete failure
      // undo a successful conversion -- the row already points at the new
      // file either way.
      admin.storage
        .from(BUCKET)
        .remove([c.path])
        .catch((e) => console.error('[convert-images-webp] old file cleanup failed:', c.path, e));

      converted++;
    } catch (err) {
      console.error('[convert-images-webp] skipped', c.url, err);
      skipped++;
    }
  }

  const updateErrors: string[] = [];
  const rowUpdates = Array.from(byRow.values());
  for (const { table, id, images, edits } of rowUpdates) {
    edits.forEach((newUrl: string, idx: number) => {
      images[idx] = newUrl;
    });
    const { error } = await admin.from(table).update({ images }).eq('id', id);
    if (error) updateErrors.push(`${table}:${id} ${error.message}`);
  }

  return NextResponse.json({
    totalRemainingBeforeBatch: totalRemaining,
    batchSize: batch.length,
    converted,
    skipped,
    attemptedUrls: attempted,
    remainingAfterBatch: Math.max(0, totalRemaining - batch.length),
    done: batch.length === 0,
    updateErrors: updateErrors.length ? updateErrors : undefined,
  });
}
