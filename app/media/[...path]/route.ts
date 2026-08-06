import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';

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

// Next.js 13 caches fetch() calls by default (indefinitely, until the next
// deploy) unless a route opts out. The Supabase client below calls fetch()
// internally for the settings read in isProxyEnabled() -- without this,
// that read gets cached on its first-ever invocation and never re-runs,
// so the media_delivery toggle would appear to do nothing no matter how
// many times it's flipped or how long you wait. force-dynamic makes both
// that settings read and the upstream image fetch below run fresh on
// every request.
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// Admin > Settings > Media Delivery (see lib/settings-api.ts,
// MediaDeliverySettings) can flip this route from "stream" to "redirect"
// mode without touching any other code or URL on the site, because every
// page/feed always links to aruhihandlooms.com/media/... regardless --
// only what THIS route does with that request changes:
//   - proxy_enabled: true  (default) -> fetch the file and stream it back,
//     so the response comes from our own domain with zero visible
//     third-party host. Costs Vercel Fast Data Transfer + Fast Origin
//     Transfer for every byte served.
//   - proxy_enabled: false -> 302-redirect straight to the Supabase URL.
//     The browser/crawler then downloads the actual bytes directly from
//     Supabase, so Vercel only pays for a tiny redirect response (counted
//     against the much larger Edge Requests quota, not the bandwidth
//     quotas). Meant as an "end of billing cycle" safety valve when
//     Vercel's bandwidth quota is close to running out -- flip it back to
//     true once the quota resets.
//
// Checked fresh on every request (no in-memory caching here) so a toggle
// flip takes effect immediately -- an in-memory per-instance cache was
// tried before, but it raced with the Cloudflare purge in media-delivery/
// route.ts: a request landing on a server instance with a stale cached
// value could still stream a 200 right after a toggle flip, and Cloudflare
// would then cache that wrong response for a full year (immutable). The
// query below is a single indexed-row read, so the extra Supabase call per
// image request is cheap enough not to matter.
async function isProxyEnabled(): Promise<boolean> {
  let value = true; // fail open: if settings can't be read, keep current (proxy) behavior
  try {
    const supabase = getServerSupabase();
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'media_delivery')
      .maybeSingle();
    const stored = data?.value as { proxy_enabled?: boolean } | undefined;
    if (typeof stored?.proxy_enabled === 'boolean') value = stored.proxy_enabled;
  } catch {
    // Supabase unreachable -- keep the fail-open default above.
  }
  return value;
}

export async function GET(_req: NextRequest, { params }: { params: { path: string[] } }) {
  if (!SUPABASE_URL || !params.path || params.path.length === 0) {
    return new NextResponse('Not found', { status: 404 });
  }

  const upstreamUrl = `${BACKEND_BASE}/${params.path.map(encodeURIComponent).join('/')}`;

  if (!(await isProxyEnabled())) {
    // Quota-saving mode: hand the browser/crawler off to Supabase directly
    // instead of streaming bytes through Vercel. 307 (not 301/302) so
    // clients preserve the GET method and this is never cached as a
    // *permanent* redirect -- once proxy_enabled flips back to true,
    // clients should come straight back through this route again.
    return NextResponse.redirect(upstreamUrl, 307);
  }

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
