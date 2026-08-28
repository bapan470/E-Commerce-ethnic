/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Without this, Next.js's webpack bundling for route handlers (app/api/**)
  // can mangle sharp's native .node binary instead of require()-ing it
  // directly at runtime. That failure only shows up in production builds
  // (local dev / `next dev` doesn't bundle the same way), and it's silent
  // here because app/api/upload-image/route.ts and
  // app/api/admin/import-image/route.ts both catch sharp errors and fall
  // back to uploading the original (non-WebP) file rather than hard-failing
  // the upload. That silent fallback is what was producing .jpeg/.jpg files
  // in the "variants" storage folder instead of .webp. This tells Next to
  // leave sharp out of the bundle and load it natively instead.
  experimental: {
    serverComponentsExternalPackages: ['sharp'],
  },
  images: {
    // FIXED: `unoptimized: true` was bypassing ALL Next.js image optimisation
    // (responsive srcset, quality reduction, lazy loading, blur placeholders).
    // Every <Image> was serving the original full-resolution Supabase file
    // directly — no resizing, no format conversion, nothing.
    //
    // Solution: use Cloudflare's free image resizing service as a custom loader
    // instead of Vercel's paid /_next/image endpoint. This gives us responsive
    // images (correct size per screen), WebP/AVIF conversion, and aggressive
    // CDN caching — all for free via Cloudflare, with zero Vercel quota usage.
    //
    // HOW IT WORKS:
    // Next.js <Image> builds a srcset URL like:
    //   https://aruhihandlooms.com/cdn-cgi/image/w=400,q=80,f=auto/<original_url>
    // Cloudflare intercepts /cdn-cgi/image/... paths at the edge, resizes the
    // image, converts to WebP/AVIF, caches the result, and serves it — all
    // without touching Vercel. Subsequent requests hit Cloudflare's cache (0ms).
    //
    // SETUP REQUIRED (one-time, 5 minutes):
    // 1. Cloudflare dashboard → your domain → Speed → Optimization
    // 2. Enable "Image Resizing" (free on all plans)
    // 3. That's it. The loader below handles the rest automatically.
    //
    // If you ever move off Cloudflare, set unoptimized: false and remove the
    // `loader` line — Next.js will fall back to /_next/image (Vercel quota).
    loader: 'custom',
    loaderFile: './lib/cloudflare-image-loader.js',
    formats: ['image/avif', 'image/webp'],
    // Keep deviceSizes tight — these are the srcset breakpoints Next generates.
    // Fewer breakpoints = fewer unique cache entries on Cloudflare.
    deviceSizes: [390, 640, 750, 1080, 1200, 1920],
    imageSizes: [64, 128, 256, 384],
    // 1 year browser cache for optimised images (Cloudflare also caches at edge)
    minimumCacheTTL: 31536000,
    remotePatterns: [
      { protocol: 'https', hostname: 'images.pexels.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'placehold.co' },
      // Supabase Storage — admin-uploaded product/variant images live here.
      // Without this, every image uploaded from the admin panel renders broken.
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
      // Cloudflare R2 — only used when STORAGE_PROVIDER=r2 (see lib/storage.ts).
      // R2_PUBLIC_URL_HOSTNAME should be the bare hostname of your R2 bucket's
      // custom domain, e.g. "cdn.yourdomain.com" (NOT the pub-xxxx.r2.dev
      // hostname — see R2-SETUP.md for why a custom domain matters here).
      ...(process.env.R2_PUBLIC_URL_HOSTNAME
        ? [{ protocol: 'https', hostname: process.env.R2_PUBLIC_URL_HOSTNAME }]
        : []),
    ],
  },
};

module.exports = nextConfig;
