# Colour-variant fix: add variants before the product is saved

File: components/admin/product-variants-manager.tsx + products-panel.tsx

- The "Colour & size variants" section used to block completely on a
  brand-new product ("Save this product first...").
- Now: as soon as you type at least ONE colour into the main product's
  "Colors" field, the "Add colour" button/form appears — even before
  you've clicked "Add Product". Colours added at this point are staged in
  memory (shown with a "Staged" badge).
- When you actually click "Add Product", every staged variant is created
  for real (with its sizes, stock, SKU, default flag) right after the
  product itself is saved.
- Works the same whether the product is single-size (Free Size) or
  multi-size — you still add the colour + its size/stock/price yourself
  via "Add colour", same as always. (An earlier draft of this fix also
  auto-created a variant for single-size products with no button press —
  that part was reverted since it surprised admins with an unwanted
  automatic default variant; single-size products now behave exactly like
  they always did, manual "Add colour" only.)

## SEO / AI generation — unaffected
Both auto-fill SEO (meta title/description/style note) and the "Generate
with AI" listing button work exactly as before.

## How to apply
Option A — replace the two files directly:
  Copy components/admin/product-variants-manager.tsx and
  components/admin/products-panel.tsx from this zip into the same paths in
  your repo, overwriting the existing ones.

Option B — apply the included patch:
  cd /path/to/E-Commerce-ethnic
  git apply changes.diff

## After applying
  git add components/admin/product-variants-manager.tsx components/admin/products-panel.tsx
  git commit -m "Allow adding colour variants before the product itself is saved"
  git push
