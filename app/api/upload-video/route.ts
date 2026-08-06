import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// ---------------------------------------------------------------------
// Server-side product video upload used by lib/products-api.ts's
// uploadProductVideo() -- the "Upload Video to Storage" button in the
// admin "Add/Edit Product" dialog's video section.
//
// IMPORTANT: this route does NOT receive the video file body anymore.
// Vercel's Node.js Serverless Functions have a hard ~4.5MB request body
// limit on every plan (Hobby/Pro/Enterprise) that cannot be raised from
// app code or vercel.json. Product videos routinely exceed that, so the
// previous version of this route (which accepted multipart/form-data
// with the raw file) silently failed with a generic "Video upload
// failed" toast for any video over ~4.5MB -- the request never even
// reached this handler; Vercel's platform rejected it (413) before
// Next.js ran, regardless of the 45MB limit enforced in this file's
// own logic.
//
// Fix: this route now only mints a short-lived signed upload URL/token
// for the `product-videos` bucket. The browser then uploads the video
// bytes DIRECTLY to Supabase Storage (uploadToSignedUrl in
// lib/products-api.ts), bypassing the Vercel function entirely -- so
// there's no 4.5MB ceiling. The admin session is still checked here
// before the token is minted, so only logged-in admins can obtain one.
// ---------------------------------------------------------------------

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

  let body: { seoName?: string; contentType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const contentType = body.contentType || 'video/mp4';
  if (!ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json({ error: 'Only .mp4 or .webm videos are supported.' }, { status: 400 });
  }

  const seoName = (body.seoName ?? '').toString();
  const slug = seoName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const ext = contentType.includes('webm') ? 'webm' : 'mp4';
  const path = `manual-uploads/${slug ? `${slug}-` : ''}${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.storage.from('product-videos').createSignedUploadUrl(path);

    if (error || !data) {
      console.error('[upload-video] signed url error:', error);
      return NextResponse.json({ error: 'Could not prepare the upload. Please try again.' }, { status: 500 });
    }

    const { data: publicUrlData } = admin.storage.from('product-videos').getPublicUrl(path);

    return NextResponse.json({
      path: data.path,
      token: data.token,
      url: publicUrlData.publicUrl,
    });
  } catch (err) {
    console.error('[upload-video] error:', err);
    return NextResponse.json({ error: 'Could not prepare the upload. Please try again.' }, { status: 500 });
  }
}
