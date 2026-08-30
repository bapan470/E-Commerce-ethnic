# Blur Placeholder — now consistent everywhere (Admin toggle finally controls all of it)

## Files changed
- `components/catalog-card-media.tsx` — Shop + Category grid product cards
- `components/product/variant-swatches.tsx` — colour swatch thumbnails on product page
- `app/shop/shop-content.tsx` — category chip circles + "related category" thumb stack on Shop page
- `app/categories/page.tsx` — category thumb stack on the Categories page

## Answering your question directly

After deploying this:

| Location | Blur now? |
|---|---|
| Shop page — product grid cards | ✅ Yes (respects Admin toggle) |
| Category page — product grid cards | ✅ Yes (respects Admin toggle) |
| Product page — colour variation swatches (the row in your screenshot) | ✅ Yes — these had **no** placeholder before at all, now fixed |
| Product page — main photo + thumbnail rail | ✅ Already worked before this fix |
| Product page — full-screen zoom viewer | ✅ Already worked before this fix |
| Shop page — top category circles + "more in this category" thumbs | ✅ Yes, now fixed too |
| Categories page — category thumb stack | ✅ Yes, now fixed too |

So yes — after this deploy, turning the Admin toggle ON shows the shimmer
everywhere images load on the storefront, and turning it OFF removes it
everywhere, consistently. All of these now read the exact same
`isBlurPlaceholderEnabled()` flag your Admin > Settings > Blur Placeholder
toggle controls.

## Not covered by this pass (separate, smaller spots — say if you want these too)
- Blog listing/detail page card thumbnails (`app/blog/page.tsx`, `app/blog/[slug]/page.tsx`, `components/blog/blog-product-card.tsx`) still use the old hardcoded shimmer, unaffected by the toggle. Cosmetic-only, not part of Shop/Category/Product flow.
- The Shop/Category grid and swatches use the **generic** shimmer, not your backfilled **per-photo real previews** (that only applies on the product detail page gallery right now). Say the word if you want the exact same per-photo blur-up everywhere too — bigger change, touches how data is fetched server-side.

## How to apply
1. Unzip into your project root, allow it to overwrite the 4 files above.
2. `git add -A`
3. `git commit -m "fix: blur placeholder now respected on shop/category grid + variant swatches"`
4. `git push`
