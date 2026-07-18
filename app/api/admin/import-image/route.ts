import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const MAX_BYTES = 15 * 1024 * 1024; // 15MB safety cap on the source image

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

export async function POST(req: Request) {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const verified = await verifyAdminToken(cookie);
  if (!verified.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const sourceUrl = (body?.url as string | undefined)?.trim();
  // "products" (default) or "variants" — just changes the storage sub-folder.
  const bucketFolder = body?.folder === 'variants' ? 'variants' : 'products';

  if (!sourceUrl) {
    return NextResponse.json({ error: 'Give an image URL to import.' }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(sourceUrl);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error('Only http(s) URLs are allowed.');
    }
  } catch {
    return NextResponse.json({ error: 'That does not look like a valid image URL.' }, { status: 400 });
  }

  try {
    const sourceRes = await fetch(parsedUrl.toString(), {
      // Some CDNs (e.g. Amazon) block requests with no browser-like UA.
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AruhiHandloomsBot/1.0)' },
    });

    if (!sourceRes.ok) {
      return NextResponse.json(
        { error: `Could not download that image (site returned ${sourceRes.status}).` },
        { status: 502 }
      );
    }

    const contentType = (sourceRes.headers.get('content-type') || '').split(';')[0].trim();
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'That URL does not point to an image.' }, { status: 400 });
    }

    const arrayBuffer = await sourceRes.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: 'Image is too large (max 15MB).' }, { status: 400 });
    }

    // Re-host the image in our own storage exactly as downloaded (no
    // conversion) — this avoids native-binary image libraries, which are
    // unreliable to run in serverless functions, while still fixing the
    // main problem: the image keeps working even if the original site
    // removes it or blocks hotlinking.
    const ext = EXT_BY_MIME[contentType] || 'jpg';
    const path = `${bucketFolder}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;

    const admin = getSupabaseAdmin();
    const { error: uploadError } = await admin.storage
      .from('product-images')
      .upload(path, Buffer.from(arrayBuffer), {
        cacheControl: '31536000',
        upsert: false,
        contentType,
      });

    if (uploadError) {
      console.error('[import-image] storage upload error:', uploadError);
      return NextResponse.json({ error: 'Could not save the image. Please try again.' }, { status: 500 });
    }

    const { data } = admin.storage.from('product-images').getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl });
  } catch (err) {
    console.error('[import-image] error:', err);
    return NextResponse.json(
      { error: 'Could not import that image. Check the URL and try again.' },
      { status: 500 }
    );
  }
}
