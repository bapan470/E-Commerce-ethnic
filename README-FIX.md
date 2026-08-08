# Blog "Generate with AI" — timeout + internal links + cover image fixes

Only file touched: `app/api/admin/generate-blog-post/route.ts`

## Fix 1 — 500/504 timeout
Switched from the slow VISION model to `meta/llama-3.1-8b-instruct`
(text-only, faster), and made a plain timeout retry once instead of
failing outright. Timings rebalanced to fit inside Vercel's 60s ceiling.

## Fix 2 — missing internal (category) links
Added `ensureCategoryLinks()`: if the model didn't embed any valid
`[text](category:Name)` link itself, the code now finds a real mention of
a category name already in the prose and links it, or as a last resort
appends one short sentence linking the related category — so a post can
never ship with zero internal links.

## Fix 3 — cover image showing "No Image" (this round)
Two causes, both fixed:

1. **Stray broken markup leaking onto the page.** The model sometimes
   drops the required `[anchor text]` and just writes a bare
   `(category:Name)` straight in a sentence — e.g. "...Banarasi silk
   saree (category:Banarasi Sarees) to the..." showing up literally on
   the live post. This wasn't a valid link so nothing caught it before.
   Now stripped with `stripStrayCategoryParens()`.
2. **No cover image at all.** The cover photo is pulled from a live
   product in `related_category_name` — but that field is only trusted
   when it exactly matches a real category, and the model sometimes
   invents a plausible-but-nonexistent one (like "Banarasi Sarees" above,
   when the real category is "Silk Sarees"). When that happens (or the
   matched category simply has no product photos yet), `related_category_
   name` ends up empty and the cover image did too — shown on the site as
   the "No Image" placeholder. Now there's a store-wide fallback: any
   live, in-stock, featured/top-rated product photo is used instead of
   leaving the field blank.

## To apply
Replace `app/api/admin/generate-blog-post/route.ts` with the copy in this
zip, or `git apply generate-blog-post-fix.patch`, then commit & push.

Note: all three fixes only affect posts generated **after** you deploy.
The already-published "A Comprehensive Guide to Sarees" post in the
screenshot won't retroactively get an image or fixed text — easiest is to
delete it from the admin blog list and regenerate the topic fresh, or
manually set a cover image and remove the stray "(category:...)" text in
the edit dialog.
