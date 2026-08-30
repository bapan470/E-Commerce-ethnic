import { NextResponse } from 'next/server';
import { getBlurPlaceholderEnabledServer } from '@/lib/blur-placeholder-flag';

// ---------------------------------------------------------------------
// GET /api/settings/blur-placeholder -> { enabled: boolean }
//
// Deliberately PUBLIC (no requireAdmin) — unlike
// /api/admin/blur-placeholder (which reads/writes the setting for the
// Admin UI), this only ever exposes a single cosmetic boolean to the
// storefront itself, nothing sensitive.
//
// WHY THIS EXISTS
//   The root layout (app/layout.tsx) reads this setting once per request
//   and hands it to the client via a `beforeInteractive` inline script
//   (`window.__BLUR_PLACEHOLDER_ENABLED__ = ...`). That works perfectly
//   for a fresh full page load — but the App Router keeps the root
//   layout mounted for a shopper's entire browsing session; it never
//   re-runs on client-side navigation between pages. So that one-time
//   value used to go stale the moment Admin toggled the setting while a
//   shopper already had the site open: shop/category grids, colour
//   swatches, and sometimes even the product gallery kept showing
//   whatever value was true when the tab first loaded, no matter what
//   Admin changed it to, until a hard refresh.
//
//   components/blur-placeholder-sync.tsx calls this on every client-side
//   route change to keep that same `window.__BLUR_PLACEHOLDER_ENABLED__`
//   global in sync, so a change in Admin reaches an already-open tab on
//   its very next page instead of needing a hard reload.
//
// Reuses the same 45s server-side cache as the layout's own read (see
// lib/blur-placeholder-flag.ts), so this adds no extra load on Supabase
// beyond what the site already does.
// ---------------------------------------------------------------------

export async function GET() {
  const enabled = await getBlurPlaceholderEnabledServer();
  return NextResponse.json({ enabled });
}
