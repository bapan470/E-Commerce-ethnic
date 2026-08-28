/**
 * lib/cloudflare-image-loader.js
 *
 * Custom Next.js image loader that serves responsive sizes.
 *
 * For NEW images (uploaded after this change):
 *   3 sizes are stored in R2/Supabase:
 *     product-abc-sm.webp   → 480px  (mobile cards)
 *     product-abc-md.webp   → 900px  (desktop cards)
 *     product-abc.webp      → 1600px (full zoom)
 *
 *   Loader picks the right suffix based on requested width:
 *     width <= 600  → -sm
 *     width <= 1000 → -md
 *     width > 1000  → original (no suffix)
 *
 * For OLD images (no -sm/-md variants exist):
 *   Falls back to original URL as-is. No broken images.
 */

export default function responsiveImageLoader({ src, width }) {
  // Pass-through: data URIs (blur placeholders)
  if (src.startsWith('data:')) return src;

  // Pass-through: external images (pexels, unsplash, etc.)
  if (src.includes('placehold.co') || src.includes('placeholder')) return src;
  if (src.includes('pexels.com') || src.includes('unsplash.com')) return src;

  // Only apply responsive sizing to our own /media/ URLs
  if (!src.includes('/media/')) return src;

  // Determine which size suffix to use
  let suffix = '';
  if (width <= 600) suffix = '-sm';
  else if (width <= 1000) suffix = '-md';
  // width > 1000 → original, no suffix

  if (!suffix) return src; // original — return as-is

  // Insert suffix before the file extension
  // e.g. /media/product-images/products/abc.webp
  //   → /media/product-images/products/abc-sm.webp
  const dotIndex = src.lastIndexOf('.');
  if (dotIndex === -1) return src; // no extension — return as-is

  const withSuffix = `${src.slice(0, dotIndex)}${suffix}${src.slice(dotIndex)}`;
  return withSuffix;
}
