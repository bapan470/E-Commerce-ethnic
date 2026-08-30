# Hotfix: build error in variant-swatches.tsx

## What broke
My earlier patch put `const blurEnabled = isBlurPlaceholderEnabled();`
inside the wrong component. This file has two components:
- `VariantSwatches` (top) — where I'd added the variable
- `VariantSwatchList` (below it) — where the `<Image>` using `blurEnabled`
  actually lives

Since they're separate functions, `blurEnabled` wasn't in scope where it
was used → `Cannot find name 'blurEnabled'` at build time.

## Fix
Moved the `blurEnabled` declaration into `VariantSwatchList`, right next
to where it's actually used. Verified with a full `tsc --noEmit` — 0
errors now.

## File changed
- `components/product/variant-swatches.tsx`

## How to apply
1. Unzip, overwrite `components/product/variant-swatches.tsx`.
2. `git add components/product/variant-swatches.tsx`
3. `git commit -m "fix: build error - blurEnabled was out of scope in variant-swatches.tsx"`
4. `git push`

(Your other 3 previously-changed files — `catalog-card-media.tsx`,
`shop-content.tsx`, `app/categories/page.tsx` — were checked too and are
fine as-is, no changes needed there.)
