# Vendor/Reseller SEO landing pages — what changed

## New files (add these)
- app/vendor-registration/page.tsx
- app/vendor-login/page.tsx
- app/reseller-registration/page.tsx
- app/reseller-login/page.tsx
- app/sell-with-us/layout.tsx  (new — adds title/description to the existing form page)

## Modified files (replace these)
- components/footer.tsx   → added a "Partner With Us" column with all 4 links
- app/sitemap.ts          → added all 4 pages (+ /sell-with-us) to sitemap.xml

## Why this structure
`/vendor/*` and `/account/*` require login (see middleware.ts). A logged-out
visitor — including Googlebot — is redirected to `/login` before any content
loads, so nothing under those paths can ever rank for "vendor login",
"reseller login", etc. These 4 new pages live outside those protected paths,
have real keyword-matched titles/descriptions, and link into the actual
login/registration flow. Nothing about the existing login/auth logic was
changed.

## After you copy these files in
1. `git add -A && git commit -m "Add vendor/reseller SEO landing pages" && git push`
2. Deploy.
3. In Google Search Console (property must already be verified for
   aruhihandlooms.com):
   - Sitemaps → resubmit `https://www.aruhihandlooms.com/sitemap.xml`
   - URL Inspection → paste each of the 4 new URLs → "Request Indexing"
4. Indexing itself is not instant — usually a few days to a couple of weeks,
   and ranking well for competitive terms takes longer and depends on
   external factors (backlinks, content depth, competition), not just
   having the page exist.

## Google policy / GMC note
No policy risk here. These are ordinary, honest content pages describing a
real registration/login flow — not cloaking, not doorway pages with fake
content, not keyword stuffing. Google Merchant Center policies govern your
*product feed* (pricing, availability, business info) — vendor/reseller
pages are unrelated to GMC and won't affect your product listing status.
