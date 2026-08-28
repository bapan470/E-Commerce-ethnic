/**
 * lib/image-sizes.ts
 * 
 * Shared utility: generate 3 responsive sizes from a sharp buffer.
 * Used by upload-image and import-image routes.
 * 
 * Sizes:
 *   -sm  → 480px  (mobile product cards, thumbnails)
 *   -md  → 900px  (desktop product cards, category pages)
 *   original → 1600px (full product page zoom)
 * 
 * Existing images (no -sm/-md suffix) are untouched — loader falls back
 * to original URL for them.
 */

import sharp from 'sharp';

const WEBP_QUALITY = 82;

export const RESPONSIVE_SIZES = [
  { suffix: '-sm', width: 480 },
  { suffix: '-md', width: 900 },
  { suffix: '',    width: 1600 }, // original / full size
] as const;

/**
 * Generate 3 WebP buffers at different sizes from a source buffer.
 * Returns array of { suffix, buffer, contentType, ext }
 */
export async function generateResponsiveSizes(sourceBuffer: Buffer): Promise<
  Array<{ suffix: string; buffer: Buffer; contentType: string; ext: string }>
> {
  const results = [];

  for (const { suffix, width } of RESPONSIVE_SIZES) {
    try {
      const buffer = await sharp(sourceBuffer, { failOn: 'none' })
        .rotate()
        .resize({ width, height: width, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();

      results.push({ suffix, buffer, contentType: 'image/webp', ext: 'webp' });
    } catch (err) {
      console.error(`[image-sizes] failed to generate ${suffix || 'original'} size:`, err);
      // Skip this size on error — caller handles missing sizes gracefully
    }
  }

  return results;
}
