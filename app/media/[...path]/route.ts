import { NextRequest, NextResponse } from 'next/server';

// Public media proxy: serves storage files (currently Supabase) under our
// own domain, so every place that surfaces a media URL externally --
// sitemap, Merchant Center / Pinterest feeds, JSON-LD video/image schema --
// shows aruhihandlooms.com instead of the storage provider's host.
//
// Swapping the underlying storage backend later (Vercel Blob, S3, etc.)
// only requires changing BACKEND_BASE below; every previously-published
// /media/... URL keeps working unchanged, so nothing needs re-indexing
// again just because the backend moved.
//
// Uses the same NEXT_PUBLIC_SUPABASE_URL already configured for the app
// (see lib/supabase.ts) rather than hardcoding the project ref.
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const BACKEND_BASE = `${SUPABASE_URL}/storage/v1/object/public`;

export async function GET(_req: NextRequest, { params }: { params: { path: string[] } }) {
  if (!SUPABASE_URL || !params.path || params.path.length === 0) {
    return new NextResponse('Not found', { status: 404 });
  }

  const upstreamUrl = `${BACKEND_BASE}/${params.path.map(encodeURIComponent).join('/')}`;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl);
  } catch {
    return new NextResponse('Upstream fetch failed', { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return new NextResponse('Not found', { status: 404 });
  }

  const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
  const contentLength = upstream.headers.get('content-length');

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      ...(contentLength ? { 'Content-Length': contentLength } : {}),
      // Uploaded files are never mutated in place (re-uploads get a new
      // filename), so it's safe for browsers/CDNs/crawlers to cache these
      // indefinitely instead of re-fetching through this proxy every time.
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
