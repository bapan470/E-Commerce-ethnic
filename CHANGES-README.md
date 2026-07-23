# Fixes in this package

Extract this zip into your project root and overwrite the matching files, then commit and push.

## 1. AI "Zari Border" / "Maroon" anchoring bug — FIXED (finally, in the actual repo)

Files:
- `lib/vendor-ai-listing.ts` — the prompt used automatically when a vendor publishes/edits a product.
- `app/api/admin/generate-listing/route.ts` — the prompt used by the admin panel's "Generate Listing" button.

What changed:
- Every field that previously had only 1–2 example values (pattern, border, ornamentation,
  surface_styling, print_or_pattern_type, colors, fabric, origin, material, blouse fields, neck,
  sleeve_styling, add_on) now lists 6–9 realistic alternatives instead of a single example.
- Added an explicit **"CRITICAL — DO NOT ANCHOR ON THE EXAMPLE VALUES"** instruction near the top of
  both prompts, telling the model the "e.g." values are just format examples, and specifically telling
  it not to say "Zari" or default to "Maroon" unless that's actually visible in the photo.

This was previously discussed and a `fixes.zip` was built for it, but it never got extracted/committed —
the last commits in the repo were only `final_price` TS-type fixes, unrelated to this. This package is
the real fix, sitting directly in your actual project files.

## 2. Vendor "Delete Product" option — NEW

Colour variation delete already existed (via "Variations" → trash icon). This adds the ability to
delete a whole product listing.

Files:
- `app/api/vendor/products/[id]/route.ts` — added a `DELETE` handler.
  - Confirms the product belongs to the logged-in vendor.
  - Blocked if the product is `awaiting_stock` (already committed to a pickup).
  - Blocked if any order for this product is still being fulfilled (stage in
    `placed / vendor_accepted / picked_from_vendor / received_at_warehouse / packed /
    shipped_to_customer / quality_hold`) — so a vendor can't delete stock that's mid-order.
  - Otherwise deletes the product row. Colour variations (`product_variants`) cascade-delete
    automatically at the DB level. Past `order_items` are untouched (their `product_id` just
    becomes `NULL`; they already keep their own copy of the product name), so order history/reports
    are unaffected.
- `lib/vendor-api.ts` — added `deleteVendorProduct(id)` client helper.
- `app/vendor/dashboard/products/page.tsx` — added a "Delete" button next to "Edit" for products in
  `live` / `rejected` / `draft` status, with a confirmation dialog (same style as the existing
  variation-delete dialog) before it actually deletes.

## How to apply

1. Extract this zip into your project root (paths already match: `app/...`, `lib/...`).
2. Overwrite the 5 files when prompted.
3. `git add -A && git commit -m "Fix AI pattern/colour anchoring + add vendor product delete" && git push`
4. Redeploy (Vercel will pick it up automatically on push if it's connected to this repo).

No database migration needed — `product_variants` already cascade-deletes and `order_items.product_id`
is already `ON DELETE SET NULL` in your existing schema.
