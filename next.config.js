/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['sharp'],
  },
  images: {
    // Custom responsive loader:
    // - New images: serves -sm (480px) / -md (900px) / original (1600px)
    //   based on requested width — right size per device, no Vercel quota
    // - Old images (no suffix variants): falls back to original URL safely
    loader: 'custom',
    loaderFile: './lib/cloudflare-image-loader.js',
    remotePatterns: [
      { protocol: 'https', hostname: 'images.pexels.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
      { protocol: 'https', hostname: 'cdn.aruhihandlooms.com' },
      { protocol: 'https', hostname: 'aruhihandlooms.com' },
      { protocol: 'https', hostname: 'www.aruhihandlooms.com' },
    ],
  },
};

module.exports = nextConfig;
