import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// ---------------------------------------------------------------------
// Server-side product video upload used by lib/products-api.ts's
// uploadProductVideo() -- the "Upload Video to Storage" button in the
// admin "Add/Edit Product" dialog's video section.
//
// This is deliberately separate from
// app/api/admin/product-video/upload/route.ts, which requires an
// existing productId and immediately stamps products.video_url server
// side (it's built for the "Generate Video" slideshow feature on an
// already-saved product). Here, on the "Add Product" dialog, the product
// may not have an id yet -- same situation as the existing image
// "Upload to Storage" button, which uploads to storage and hands back a
// bare URL that the form holds in local state (form.video_url) until
// Save is clicked. This route mirrors that pattern for video files.
//
// No transcoding happens here (unlike upload-image's sharp/WebP step --
// there's no equivalent lightweight, dependency-free video transcoder
// available server-side in this environment), so the file is stored
// as-is; the client only accepts .mp4/.webm to begin with.
// ---------------------------------------------------------------------

const MAX_BYTES = 45 * 1024 * 1024; // 45MB -- under the product-videos bucket's 50MB cap
const ALLOWED_TYPES = new Set(['video/mp4', 'video/webm']);

async function requireAdmin() {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const verified = await verifyAdminToken(cookie);
  return verified.valid;
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data with a file field.' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No video file provided.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Video is too large (max 45MB).' }, { status: 400 });
  }
  const contentType = file.type || 'video/mp4';
  if (!ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json({ error: 'Only .mp4 or .webm videos are supported.' }, { status: 400 });
  }

  const seoName = (form.get('seoName') as string | null) ?? '';
  const slug = seoName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const ext = contentType.includes('webm') ? 'webm' : 'mp4';
  const path = `manual-uploads/${slug ? `${slug}-` : ''}${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const admin = getSupabaseAdmin();
    const { error: uploadError } = await admin.storage
      .from('product-videos')
      .upload(path, Buffer.from(arrayBuffer), {
        cacheControl: '31536000',
        upsert: false,
        contentType,
      });

    if (uploadError) {
      console.error('[upload-video] storage upload error:', uploadError);
      return NextResponse.json({ error: 'Could not save the video. Please try again.' }, { status: 500 });
    }

    const { data } = admin.storage.from('product-videos').getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl });
  } catch (err) {
    console.error('[upload-video] error:', err);
    return NextResponse.json({ error: 'Could not upload that video. Please try again.' }, { status: 500 });
  }
}
