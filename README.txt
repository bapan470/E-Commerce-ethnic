VIDEO SHOPPING BOTTOM-NAV TAB — WHAT CHANGED
=============================================

5 files, matching your repo's folder structure. Copy each into the same
path in your project (overwrite the 4 existing ones, add the 1 new one),
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

4. app/product/[slug]/product-detail.tsx (MODIFIED)
   - Removed the standalone "Watch Product Video" button below the
     product gallery on the product page. The small round video-peek
     bubble on the gallery photo itself is untouched (that wasn't part
     of what you asked to remove) — shoppers can still tap that, or use
     the new Video tab in the bottom nav, to watch product videos.

5. app/api/products/video-feed/route.ts (MODIFIED)
   - Now also selects category_name and includes it as `category` on each
     feed item, so the video card (below) has something to show.

3. components/product/video-reels.tsx (MODIFIED — updated again)
   - Added returnHref (as before) and the category/Free Delivery row
     under the price (as before).
   - FIX: variation swatch thumbnails were 44x44 squares, cropping tall
     saree photos to a thin cut-off-looking middle slice. Now 44x64
     (portrait, closer to the real photo's proportions) and anchored to
     the top of the image instead of the center, so the full look shows
     properly instead of appearing "half cut".
   - FIX: category label under the price is now clickable — tapping it
     navigates to /shop?category=... (same destination the shop grid's
     own category label already uses), so a shopper can jump straight
     to that category from inside the video feed.

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
