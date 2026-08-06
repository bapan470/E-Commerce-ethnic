// Rewrites storage URLs (currently Supabase) into our own domain via the
// /media proxy (see app/media/[...path]/route.ts), so every place a media
// URL gets published externally -- sitemap, Merchant Center / Pinterest
// feed, JSON-LD video/image schema -- shows aruhihandlooms.com instead of
// the storage provider's host. If the storage backend ever changes (e.g.
// Supabase -> Vercel Blob/S3), only the proxy route's upstream needs to
// change; every previously-published URL keeps resolving unchanged, so
// nothing needs to be re-indexed again.
//
// Intentionally NOT used for on-page <img>/<video> src (see product-detail
// rendering) -- routing every visitor's page load through this proxy would
// add real bandwidth/latency cost for zero SEO benefit, since Google Images
// and on-site rendering don't need the same URL as the sitemap/feed do.
// This only rewrites URLs that get published to crawlers/feeds.

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.aruhihandlooms.com').replace(/\/$/, '');
const SUPABASE_PUBLIC_MARKER = '/storage/v1/object/public/';

/**
 * Converts a single Supabase Storage public URL into our own-domain proxy
 * URL. Non-Supabase URLs (e.g. Pexels/Unsplash placeholders) and anything
 * already on our own domain are returned unchanged.
 */
export function toPublicMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith(SITE_URL) || url.startsWith('/media/')) return url;

  const markerIndex = url.indexOf(SUPABASE_PUBLIC_MARKER);
  if (markerIndex === -1) return url;

  const path = url.slice(markerIndex + SUPABASE_PUBLIC_MARKER.length);
  return `${SITE_URL}/media/${path}`;
}

/** Same as toPublicMediaUrl, but for an array, dropping any null/empty entries. */
export function toPublicMediaUrls(urls: (string | null | undefined)[] | null | undefined): string[] {
  if (!urls) return [];
  return urls
    .map((u) => toPublicMediaUrl(u))
    .filter((u): u is string => !!u);
}
