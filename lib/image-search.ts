'use client';

/**
 * Lightweight "search by image" for the catalog.
 *
 * There's no ML backend for this app, so instead of a real vision model we
 * boil every photo down to a coarse 8x8 grid of average RGB values (192
 * numbers total). That's enough to capture dominant colour + rough layout,
 * which works surprisingly well for a saree/lehenga/kurti catalog where
 * shoppers are usually hunting for "something that looks like this" rather
 * than an exact pixel match.
 */

const GRID = 8;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Needed so getImageData() doesn't throw on cross-origin product photos
    // (e.g. Supabase storage). If the host doesn't send CORS headers this
    // will fail and the caller treats the product as "unrankable" rather
    // than crashing the whole search.
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

/** Returns a 192-number colour/layout fingerprint, or null if it couldn't be read. */
export async function getImageSignature(src: string): Promise<number[] | null> {
  if (!src) return null;
  try {
    const img = await loadImage(src);
    const canvas = document.createElement('canvas');
    canvas.width = GRID;
    canvas.height = GRID;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, GRID, GRID);
    const { data } = ctx.getImageData(0, 0, GRID, GRID);
    const sig: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      sig.push(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255);
    }
    return sig;
  } catch {
    return null;
  }
}

/** Lower = more visually similar. */
export function signatureDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/**
 * Ranks products by visual similarity to an uploaded query image (most
 * similar first). Products whose photo can't be fingerprinted — missing
 * image, CORS-blocked host, decode failure — are silently skipped instead
 * of breaking the whole search for everyone else.
 */
export async function rankProductIdsByImage<T extends { id: string; images: string[] | null | undefined }>(
  products: T[],
  queryImageSrc: string
): Promise<string[]> {
  const querySig = await getImageSignature(queryImageSrc);
  if (!querySig) return [];

  const scored: { id: string; dist: number }[] = [];
  const CONCURRENCY = 6;
  let cursor = 0;

  async function worker() {
    while (cursor < products.length) {
      const p = products[cursor++];
      const src = p.images?.[0];
      if (!src) continue;
      const sig = await getImageSignature(src);
      if (sig) scored.push({ id: p.id, dist: signatureDistance(querySig, sig) });
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  scored.sort((a, b) => a.dist - b.dist);
  return scored.map((s) => s.id);
}
