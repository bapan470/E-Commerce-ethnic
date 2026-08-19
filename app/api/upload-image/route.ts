import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { uploadToStorage } from '@/lib/storage';

// ---------------------------------------------------------------------
// Server-side image upload used by lib/products-api.ts's
// uploadProductImage() -- the "Upload to Storage" button in the admin
// products/variants panels and the vendor add/edit-product pages.
//
// Previously that function uploaded the raw File straight from the
// browser to Supabase Storage with the anon key -- whatever format the
// browser handed it (JPEG/PNG/HEIC/whatever the phone camera produced)
// is exactly what got stored. sharp can't run in the browser (it's a
// native binary), so there was no way to actually convert to WebP on
// that path -- only the URL-import route touched sharp at all.
//
// This route does the same anon-insertable 'product-images' bucket
// write, but server-side, so it can run the file through sharp and
// store a real .webp file every time -- consistent with the URL-import
// path, and with the "converted to WebP" messaging shown in the admin
// UI.
// ---------------------------------------------------------------------

const MAX_BYTES = 15 * 1024 * 1024; // 15MB safety cap, same as import-image
const WEBP_QUALITY = 82;
// Same reasoning as import-image/route.ts's MAX_DIMENSION -- caps pixel
// dimensions so WebP re-encoding actually shrinks phone-camera-sized
// originals (often 3000-4000px wide) instead of just changing the format
// while leaving files at 300-600kB+ each.
const MAX_DIMENSION = 1600;
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/heic',
  'image/heif',
]);

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data with a file field.' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Image is too large (max 15MB).' }, { status: 400 });
  }
  if (file.type && !ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Unsupported image type.' }, { status: 400 });
  }

  // "products" (default) or "variants" — just changes the storage sub-folder,
  // same convention as import-image/route.ts.
  const folder = form.get('folder') === 'variants' ? 'variants' : 'products';
  const seoName = (form.get('seoName') as string | null) ?? '';
  const slug = seoName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  try {
    const arrayBuffer = await file.arrayBuffer();
    let uploadBuffer = Buffer.from(arrayBuffer);
    let uploadContentType = file.type || 'application/octet-stream';
    let ext = 'webp';

    // Real WebP conversion via sharp. `failOn: 'none'` is important here --
    // sharp's default (`'warning'`) hard-throws on any non-fatal decode
    // warning, and phone-camera/watermark apps very commonly write
    // non-standard EXIF/APP metadata that trips this even though the file
    // opens completely fine in every browser. Without this, conversion
    // would silently fail for exactly those photos and the original file
    // (wrong extension, no real compression) would get uploaded instead --
    // which is what was happening. `.rotate()` with no args auto-applies
    // the EXIF orientation before re-encoding, so photos taken in portrait
    // don't come out sideways once the EXIF tag is dropped by the webp
    // re-encode. Still falls back to uploading the original bytes/format
    // if sharp genuinely can't decode the source (e.g. a truly corrupt
    // file), so an unusual file never hard-fails the whole upload.
    try {
      uploadBuffer = await sharp(uploadBuffer, { failOn: 'none' })
        .rotate()
        .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
      uploadContentType = 'image/webp';
      ext = 'webp';
    } catch (convErr) {
      console.error('[upload-image] webp conversion error, falling back to original format:', convErr);
      const fallbackExt = (file.name.split('.').pop() || 'jpg').toLowerCase();
      ext = fallbackExt;
    }

    const path = `${folder}/${slug ? `${slug}-` : ''}${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;

    // Routes to Supabase Storage or Cloudflare R2 depending on the
    // STORAGE_PROVIDER env var -- see lib/storage.ts.
    const { url } = await uploadToStorage({
      bucket: 'product-images',
      path,
      buffer: uploadBuffer,
      contentType: uploadContentType,
    });
    return NextResponse.json({ url });
  } catch (err) {
    console.error('[upload-image] error:', err);
    return NextResponse.json({ error: 'Could not upload that image. Please try again.' }, { status: 500 });
  }
}
