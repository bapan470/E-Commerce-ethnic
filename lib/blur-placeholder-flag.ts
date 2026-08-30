// ---------------------------------------------------------------------
// Blur Placeholder — feature flag (Admin > Settings > Blur Placeholder).
//
// WHAT THIS CONTROLS
//   ON (default): every product-gallery <Image> shows a soft animated
//     shimmer the instant it mounts, instead of a blank/white box, while
//     the real photo is still downloading. This is a GENERIC placeholder
//     (a tiny inline SVG, not a preview of the actual photo) — so unlike
//     Responsive Images it needs NO backfill and applies to every image,
//     old or new, the moment it's turned on. See lib/image-placeholder.ts
//     for the shimmer itself.
//   OFF: <Image> renders with no placeholder — exactly like before this
//     feature existed (plain background colour from the surrounding
//     container until the photo arrives).
//
// FAIL-SAFE DEFAULT
//   Any error reading the setting (Supabase unreachable, row missing,
//   etc.) resolves to `true` (shimmer shown) — the safer choice for a
//   purely cosmetic loading-state feature, since showing a shimmer can
//   never break a page the way a broken image URL could. Same
//   cache/global-sync pattern as lib/responsive-images-flag.ts.
// ---------------------------------------------------------------------

import { getServerSupabase } from '@/lib/supabase-server';

export interface BlurPlaceholderSettings {
  enabled: boolean;
}

export const DEFAULT_BLUR_PLACEHOLDER_SETTINGS: BlurPlaceholderSettings = {
  enabled: true,
};

const SETTINGS_KEY = 'blur_placeholder';
const CACHE_TTL_MS = 45_000;

let cache: { value: boolean; expiresAt: number } | null = null;

export async function getBlurPlaceholderEnabledServer(): Promise<boolean> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;

  let enabled = true;
  try {
    const supabase = getServerSupabase();
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle();
    const v = data?.value as Partial<BlurPlaceholderSettings> | undefined;
    if (typeof v?.enabled === 'boolean') enabled = v.enabled;
  } catch {
    // Fail open to the safe default; don't cache the failure so the
    // very next request tries Supabase again instead of being stuck.
    return true;
  }

  cache = { value: enabled, expiresAt: now + CACHE_TTL_MS };
  return enabled;
}

/**
 * Makes the current value available synchronously to client components
 * (ProductGallery is 'use client' and can't await a database call).
 * Call this once per request from the root layout — before children
 * render — mirroring syncResponsiveImagesServerGlobal().
 */
export function syncBlurPlaceholderServerGlobal(enabled: boolean): void {
  (globalThis as unknown as Record<string, unknown>).__BLUR_PLACEHOLDER_ENABLED__ = enabled;
}
