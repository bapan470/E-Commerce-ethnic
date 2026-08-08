# AruhiHandlooms blog — AI generation + product catalog fixes

Three files touched:
- `app/api/admin/generate-blog-post/route.ts`
- `app/blog/[slug]/page.tsx`
- `lib/products-api-server.ts`

## 1. 500/504 timeout on "Generate with AI"
Swapped the slow VISION model for the lighter, faster
`meta/llama-3.1-8b-instruct` (this route is text-only, no image involved),
and made a plain timeout retry once instead of failing outright.

## 2. Missing internal (category) links
Added `ensureCategoryLinks()`: guarantees at least one real
`[text](category:Name)` link in every generated post, either by linking an
actual category mention already in the prose, or appending one short
sentence linking the related category — no longer fully dependent on the
model remembering to do it itself.

## 3. Cover image showing "No Image"
- Stripped stray broken `(category:Name)` text the model sometimes leaves
  in the prose without the required `[brackets]` (was leaking onto the
  live page as literal text).
- Cover image now falls back to any live/in-stock/featured product photo
  store-wide when the model's `related_category_name` doesn't match a real
  category (it sometimes invents one, e.g. "Banarasi Sarees" when the real
  category is "Silk Sarees") — never blank anymore.

## 4. Similar-products catalog in the blog post (this round)
This is what you just asked for. The blog post already had a "You Might
Also Like" product grid at the bottom (`app/blog/[slug]/page.tsx`) — but
it only ever pulled from `post.related_category_name`, so it silently
showed NOTHING whenever that field was empty (same root cause as the
cover-image bug: the AI's category guess not matching a real category).

Added `fetchFeaturedProductsServer()` in `lib/products-api-server.ts` — a
store-wide "best available products" fallback (live, in-stock, sorted by
featured then rating) — and wired it into the blog page: if the
category-matched grid comes back empty, it now falls back to this so
every blog post always shows a real product catalog at the end, AI-picked
either way (by category match first, or by featured/rating store-wide).

## To apply
Replace all three files with the copies in this zip, or
`git apply all-fixes.patch`, then commit & push.

Note: fixes 1–4 only affect posts generated **after** you deploy. Fix 4
(the catalog fallback) DOES also apply retroactively to already-published
posts, since it's read at page-render time, not generation time — no need
to regenerate old posts for that one.
