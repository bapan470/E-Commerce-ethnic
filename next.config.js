/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // 'sharp' is a native (C++) module. If webpack tries to bundle it into the
  // route handler, the serverless function crashes on Vercel at runtime
  // (returns an HTML error page instead of JSON). Marking it external tells
  // Next.js to leave it as a plain node_modules dependency, which Vercel's
  // own build tracing then includes with the correct linux binary.
  experimental: {
    serverComponentsExternalPackages: ['sharp'],
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
