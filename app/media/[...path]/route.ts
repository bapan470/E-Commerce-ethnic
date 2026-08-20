import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';

// Public media proxy: serves storage files under our own domain, so every
// place that surfaces a media URL externally — sitemap, Merchant Center /
// Pinterest feeds, JSON-LD video/image schema — shows aruhihandlooms.com
// instead of the storage provider's host.
//
// DUAL-WRITE UPDATE (feature/media-dual-write-toggle)
// Since every new upload goes to BOTH Supabase and R2, this route can now
// try either backend first (controlled by the admin toggle in DB setting
// media_storage_backend) and automatically fall back to the other if the
// preferred one 404s or errors. For the ~500 pre-existing Supabase-only
// files, R2 will 404 → fallback to Supabase succeeds. For new dual-written
// files, either backend works.

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_BACKEND_BASE = `${SUPABASE_URL}/storage/v1/object/public`;

const R2_CDN_BASE = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

// -----------------------------------------------------------------------
// Settings reads, cached in-memory for a short TTL.
//
// This route serves EVERY image/video on the site, so a per-request
// Supabase query here was burning Fluid Active CPU time (confirmed via
// Vercel Usage dashboard — Fluid Active CPU hit 100% of the Hobby plan's
// 4-hour/month included quota, triggering the "approaching your limits"
// email and risking an auto-pause). Both admin toggles this reads
// (media_delivery, media_storage_backend) are flipped rarely and
// deliberately, and both toggle routes already call Cloudflare's
// purge_cache on save — so a short TTL here is safe: within ~45s of an
// admin flipping a toggle, Vercel's own cached value also expires and
// picks up the new setting, on top of Cloudflare no longer serving old
// cached image responses.
// -----------------------------------------------------------------------

const SETTINGS_CACHE_TTL_MS = 45_000;
let settingsCache: { value: { proxyEnabled: boolean; preferredBackend: 'supabase' | 'r2' }; expiresAt: number } | null = null;

async function getSettings(): Promise<{ proxyEnabled: boolean; preferredBackend: 'supabase' | 'r2' }> {
  const now = Date.now();
  if (settingsCache && settingsCache.expiresAt > now) {
    return settingsCache.value;
  }

  let proxyEnabled = true;
  let preferredBackend: 'supabase' | 'r2' = 'supabase';
  try {
    const supabase = getServerSupabase();
    const { data: rows } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['media_delivery', 'media_storage_backend']);

    for (const row of rows ?? []) {
      if (row.key === 'media_delivery') {
        const v = row.value as { proxy_enabled?: boolean } | undefined;
        if (typeof v?.proxy_enabled === 'boolean') proxyEnabled = v.proxy_enabled;
      }
      if (row.key === 'media_storage_backend') {
        const v = row.value as { backend?: string } | undefined;
        if (v?.backend === 'r2' && R2_CDN_BASE) preferredBackend = 'r2';
      }
    }
  } catch {
    // Supabase unreachable — use fail-open defaults (and don't cache a
    // failure, so the next request retries instead of being stuck for 45s)
    return { proxyEnabled, preferredBackend };
  }

  const value = { proxyEnabled, preferredBackend };
  settingsCache = { value, expiresAt: now + SETTINGS_CACHE_TTL_MS };
  return value;
}

// -----------------------------------------------------------------------
// Upstream fetch with auto-fallback
// -----------------------------------------------------------------------

function buildUpstreamUrl(backend: 'supabase' | 'r2', pathSegments: string[]): string | null {
  const encoded = pathSegments.map(encodeURIComponent).join('/');
  if (backend === 'r2') {
    if (!R2_CDN_BASE) return null;
    return `${R2_CDN_BASE}/${encoded}`;
  }
  if (!SUPABASE_URL) return null;
  return `${SUPABASE_BACKEND_BASE}/${encoded}`;
}

async function fetchFromUpstream(
  pathSegments: string[],
  preferredBackend: 'supabase' | 'r2',
  range: string | null
): Promise<{ response: Response; backend: string } | null> {
  const order: Array<'supabase' | 'r2'> =
    preferredBackend === 'r2' ? ['r2', 'supabase'] : ['supabase', 'r2'];

  for (const backend of order) {
    const url = buildUpstreamUrl(backend, pathSegments);
    if (!url) continue; // skip if env vars missing for this backend

    try {
      const upstream = await fetch(url, range ? { headers: { Range: range } } : undefined);
      if (upstream.ok || upstream.status === 206) {
        return { response: upstream, backend };
      }
      // 404 or other error from this backend → try the next one
    } catch {
      // Network error from this backend → try the next one
    }
  }
  return null; // both backends failed
}

// -----------------------------------------------------------------------
// Route handler
// -----------------------------------------------------------------------

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  if (!params.path || params.path.length === 0) {
    return new NextResponse('Not found', { status: 404 });
  }

  const { proxyEnabled, preferredBackend } = await getSettings();

  // Quota-saving redirect mode: hand browser/crawler off to Supabase directly
  if (!proxyEnabled) {
    const redirectUrl = buildUpstreamUrl('supabase', params.path);
    if (!redirectUrl) return new NextResponse('Not found', { status: 404 });
    return NextResponse.redirect(redirectUrl, 307);
  }

  const range = req.headers.get('range');
  const result = await fetchFromUpstream(params.path, preferredBackend, range);

  if (!result || !result.response.body) {
    return new NextResponse('Not found', { status: 404 });
  }

  const { response: upstream } = result;
  const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
  const contentLength = upstream.headers.get('content-length');
  const contentRange = upstream.headers.get('content-range');
  const isPartial = upstream.status === 206;

  return new NextResponse(upstream.body, {
    status: isPartial ? 206 : 200,
    headers: {
      'Content-Type': contentType,
      ...(contentLength ? { 'Content-Length': contentLength } : {}),
      ...(contentRange ? { 'Content-Range': contentRange } : {}),
      'Accept-Ranges': 'bytes',
      // Uploaded files are never mutated in place (re-uploads get a new
      // filename), so it's safe for browsers/CDNs/crawlers to cache these
      // indefinitely.
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
