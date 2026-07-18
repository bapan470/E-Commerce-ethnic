/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    // Netlify's Next.js runtime supports the built-in Image Optimization API,
    // so images get auto resized/compressed (WebP/AVIF) per device instead of
    // shipping full-size originals. This was previously disabled, which was
    // the main cause of slow image loading on mobile.
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
