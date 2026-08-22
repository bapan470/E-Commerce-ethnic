VIDEO SHOPPING BOTTOM-NAV TAB — WHAT CHANGED
=============================================

3 files, matching your repo's folder structure. Copy each into the same
path in your project (overwrite the 2 existing ones, add the 1 new one),
then `git push` as usual.

1. components/mobile-bottom-nav.tsx   (MODIFIED)
   - "Offers" tab removed, replaced with a "Video" tab (Video icon,
     links to /video-shopping).

2. app/video-shopping/page.tsx        (NEW)
   - New standalone page. Fetches every product/variant that has a
     video (same /api/products/video-feed your product pages already
     use) and opens the existing full-screen Reels-style video feed,
     starting on the newest video. Closing (X) goes back to Home.
   - If no product has a video yet, shows "No product videos available
     right now — tap anywhere to go back" instead of a blank/broken page.

3. components/product/video-reels.tsx (MODIFIED)
   - Added one optional prop: returnHref. When the feed is opened from
     a product page (unchanged, existing behaviour), closing still goes
     back to that product. When opened from the new /video-shopping
     page, closing goes back to "/" instead. No other behaviour changed.

VERIFIED
--------
Ran `tsc --noEmit` (full project type-check) after these changes —
0 errors.

NOTE
----
This only adds the tab and wires up the feed. It does NOT touch which
products actually have videos — that's still whatever you've already
uploaded via the admin panel's product video field. If the tab opens to
"No product videos available", it just means no product currently has
a video attached.
