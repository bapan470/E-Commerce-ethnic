# Blog "Generate with AI" — timeout fix + guaranteed internal links

Only file touched: `app/api/admin/generate-blog-post/route.ts`

## Fix 1 — 500/504 timeout (previous round)
- Model switched from the VISION model (`meta/llama-3.2-11b-vision-instruct`,
  slow + unnecessary for text-only blog generation) to the lighter
  `meta/llama-3.1-8b-instruct`.
- Timeout now retries once (previously only "truncated" retried, a plain
  timeout failed outright).
- Time budget rebalanced: 35s first attempt, 18s retry, inside Vercel's 60s
  ceiling.

## Fix 2 — missing internal (category) links (this round)
Root cause: the prompt asks the model to embed
`[anchor text](category:Category Name)` links itself, but the lighter/
faster 8b model (needed for fix 1) follows that instruction far less
reliably than the bigger vision-instruct model used to.

Added `ensureCategoryLinks()`, called right after the AI response is
parsed:
1. If the model already embedded at least one *valid* category link,
   nothing changes — no double-linking.
2. Otherwise it looks for a real mention of a category name (or its simple
   singular, e.g. "Sarees" → "saree") already present in the generated
   prose, and wraps that exact word in the link markup — reads exactly as
   if the model had done it, up to 2 links.
3. If literally no category name appears anywhere in the text, it appends
   one short sentence linking the related category to a paragraph roughly
   halfway through the post — so a post can never ship with zero internal
   links.

This runs entirely server-side, deterministically, so it can't fail or
time out — it's a plain string operation on the already-generated text.

## To apply
Replace `app/api/admin/generate-blog-post/route.ts` with the copy in this
zip, or `git apply generate-blog-post-fix.patch`, then commit & push.

Note: this only affects posts generated **after** you deploy this fix.
Older already-published posts that shipped without links won't retroactively
get them — regenerate/edit those manually if needed.
