import { NextResponse } from 'next/server';

// ---------------------------------------------------------------------
// Same-origin image proxy — fixes "search by photo" silently matching
// nothing.
//
// lib/image-search.ts reads pixel data off a <canvas> to fingerprint each
// product photo. That only works if the image was loaded from the same
// origin OR from a host that sends proper CORS headers. Supabase Storage
// buckets don't always send those (depends on bucket/proxy config), so
// `ctx.getImageData()` was throwing a SecurityError ("tainted canvas") for
// every product, which lib/image-search.ts silently swallows — so instead
// of an error, shoppers just saw "Couldn't match that photo to any
// products" no matter what they uploaded.
//
// Fix: fetch the image bytes here on the server (no CORS restriction
// server-to-server) and stream them back to the browser from our own
// origin. The client then loads the photo from
// `/api/image-proxy?url=...` instead of the raw Supabase URL, so the
// canvas is never cross-origin and getImageData() always works.
// ---------------------------------------------------------------------

export const runtime = 'nodejs';

const FETCH_TIMEOUT_MS = 8000;

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '0.0.0.0' ||
    h === '::1' ||
    h.endsWith('.local') ||
    h.startsWith('10.') ||
    h.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(h)
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const src = searchParams.get('url') || '';

  let parsed: URL;
  try {
    parsed = new URL(src);
  } catch {
    return NextResponse.json({ error: 'invalid url' }, { status: 400 });
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return NextResponse.json({ error: 'invalid protocol' }, { status: 400 });
  }
  if (isBlockedHost(parsed.hostname)) {
    return NextResponse.json({ error: 'blocked host' }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const upstream = await fetch(parsed.toString(), { signal: controller.signal });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: 'fetch failed' }, { status: 502 });
    }

    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'not an image' }, { status: 415 });
    }

    const buf = await upstream.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // Cacheable — product photos rarely change and this avoids
        // re-proxying the same image on every search.
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      },
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'AbortError';
    return NextResponse.json({ error: timedOut ? 'timeout' : 'error' }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
