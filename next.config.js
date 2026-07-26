/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
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
    // Trade-off: no automatic resize/WebP/AVIF conversion, so pages are
    // a bit heavier. If/when the Vercel plan is upgraded (or usage-based
    // pricing is enabled) for Image Optimization, this can be set back
    // to `false` (or removed) to restore automatic optimization.
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
    ],
  },
};

module.exports = nextConfig;
