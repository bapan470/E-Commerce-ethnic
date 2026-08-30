import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server-auth';
import { uploadToStorage } from '@/lib/storage';
import { storeBlurPreview } from '@/lib/blur-preview';

// ---------------------------------------------------------------------
// POST /api/upload-review-photo
//
// Server-side review photo upload — replaces the browser-direct Supabase
// upload in lib/reviews-api.ts's uploadReviewPhoto(). Routing through
// here gives the same dual-write (Supabase + R2 mirror) and canonical
// /media/ URL that all other uploads now get.
//
// Requires an authenticated user (any logged-in customer). File size is
// capped at 10MB (review photos don't need to be huge). No WebP
// conversion here — kept simple to match the original behaviour.
// ---------------------------------------------------------------------

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
]);

export async function POST(req: Request) {
  // Must be a logged-in customer
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Please log in to upload review photos.' }, { status: 401 });
  }

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
    return NextResponse.json({ error: 'Photo is too large (max 10MB).' }, { status: 400 });
  }
  if (file.type && !ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Unsupported image type.' }, { status: 400 });
  }

  try {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { url } = await uploadToStorage({
      bucket: 'review-images',
      path,
      buffer,
      contentType: file.type || 'image/jpeg',
    });

    // Real per-image blur preview (LQIP), keyed by the same canonical
    // URL just stored. storeBlurPreview never throws, so this can never
    // fail or block the upload response.
    if (url) await storeBlurPreview(url, buffer);

    return NextResponse.json({ url });
  } catch (err) {
    console.error('[upload-review-photo] error:', err);
    return NextResponse.json({ error: 'Could not upload photo. Please try again.' }, { status: 500 });
  }
}
