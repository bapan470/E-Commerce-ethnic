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
    // Vercel's built-in Image Optimization API (the /_next/image endpoint)
    // has a monthly quota on the Hobby plan. Once that quota is used up,
    // Vercel returns 402 Payment Required for every further optimized
    // image request -- which breaks every <Image> on the site (product
    // photos, thumbnails, everything), even though the underlying files
    // in Supabase Storage are completely fine.
    //
    // `unoptimized: true` makes next/image render the ORIGINAL file URL
    // directly instead of routing it through /_next/image, so it no
    // longer touches that paid quota at all -- images just work again.
    // Keep this `true` even if/when the Vercel quota isn't an issue
    // (upgraded plan, usage-based billing enabled, etc.): product images
    // are now actually converted to WebP server-side at upload/import
    // time (see app/api/upload-image/route.ts and
    // app/api/admin/import-image/route.ts), so the /_next/image
    // resize+reformat step is mostly redundant for this site's own
    // images. Only flip this back to `false` if you specifically want
    // Vercel's automatic responsive resizing on top of that.
    unoptimized: true,
    formats: ['image/avif', 'image/webp'],
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
        ? [{ protocol: 'https' as const, hostname: process.env.R2_PUBLIC_URL_HOSTNAME }]
        : []),
    ],
  },
};

module.exports = nextConfig;
