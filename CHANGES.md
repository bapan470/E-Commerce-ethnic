# Fix: Blur placeholder not showing on Shop / Category product grid

## Root cause
`components/catalog-card-media.tsx` (used by `ProductCard`, which powers
the Shop page and Category page product grids) was using its own old,
hardcoded shimmer helper from `lib/utils.ts` — completely separate from
the "Blur Placeholder" feature you set up in Admin > Settings.

Because of that:
- The Admin toggle (Admin > Settings > Blur Placeholder) had **zero effect**
  on the Shop/Category grid — only the individual product page's photo
  gallery (`components/product/product-gallery.tsx`) was wired to it.
- The old shimmer also didn't match the new one visually (different
  colors/timing) and never used the real per-image blur previews you
  backfilled (815/815 in your settings screenshot).

## Fix
`components/catalog-card-media.tsx` now imports and uses the same
flag + shimmer as the product page:
- `isBlurPlaceholderEnabled()` — reads the live Admin toggle
- `THUMB_BLUR_DATA_URL` — the same shimmer SVG used elsewhere

Now the Shop and Category grid cards correctly show the shimmer when
the toggle is ON, and show no placeholder when it's OFF — consistent
with the product detail page.

## File changed
- `components/catalog-card-media.tsx`

## How to apply
1. Unzip this into your project root, allowing it to overwrite
   `components/catalog-card-media.tsx`.
2. `git add components/catalog-card-media.tsx`
3. `git commit -m "fix: shop/category grid now respects Blur Placeholder admin toggle"`
4. `git push`

## Note (optional follow-up, not included in this fix)
The Shop/Category grid still uses the *generic* shimmer, not the
per-image "real photo previews" you generated via the backfill —
that would need the blur-preview lookup plumbed from the server page
down into `ProductCard`/`CatalogCardMedia`, which is a bigger change
touching several files (`shop-content.tsx`, `category-toolbar-grid.tsx`,
`home-client.tsx`). Happy to do that next if you want the exact same
per-photo blur-up look everywhere, not just on the product page.
