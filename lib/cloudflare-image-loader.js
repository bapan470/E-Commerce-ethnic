/**
 * lib/cloudflare-image-loader.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Custom Next.js image loader that routes through Cloudflare Image Resizing
 * instead of Vercel's /_next/image endpoint.
 *
 * WHY:
 *   Vercel's image optimisation has a monthly quota on Hobby/Pro plans.
 *   Cloudflare Image Resizing (cloudflare.com/products/image-resizing) is
 *   FREE on all plans and does the same thing — resize, convert to WebP/AVIF,
 *   cache at the CDN edge — with zero quota limits.
 *
 * HOW:
 *   Cloudflare automatically intercepts requests to /cdn-cgi/image/... on any
 *   domain proxied through Cloudflare. No Workers, no extra config needed
 *   beyond enabling "Image Resizing" in the dashboard (Speed > Optimization).
 *
 * SETUP (one-time, ~2 minutes):
 *   1. Cloudflare Dashboard → your domain (aruhihandlooms.com)
 *   2. Speed → Optimization → Image Resizing → toggle ON
 *   3. Done. This file handles the URL format automatically.
 *
 * RESULT:
 *   A mobile user requesting a 390px wide product card gets a 390px WebP/AVIF
 *   (~20-40KB) instead of the original 1200px WebP (~150-300KB).
 *   Cloudflare caches the resized version at the edge for 1 year.
 *   Second request = 0ms (pure cache hit, never touches Supabase).
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * @param {{ src: string, width: number, quality?: number }} params
 * @returns {string}
 */
export default function cloudflareImageLoader({ src, width, quality }) {
  // Pass-through for data: URIs (blur placeholders) — Cloudflare can't resize
  // these and they don't need it (they're already tiny base64 strings).
  if (src.startsWith('data:')) return src;

  // Pass-through for placeholder images (local dev / missing images)
  if (src.includes('placehold.co') || src.includes('placeholder')) return src;

  const q = quality || 80;

  // Cloudflare Image Resizing URL format:
  // /cdn-cgi/image/<options>/<image-url>
  // Options: w (width), q (quality 1-100), f (format: auto/webp/avif)
  // "f=auto" lets Cloudflare pick the best format the browser supports
  // (AVIF for Chrome/Firefox, WebP for Safari, JPEG fallback for old browsers)
  return `/cdn-cgi/image/w=${width},q=${q},f=auto/${src}`;
}
