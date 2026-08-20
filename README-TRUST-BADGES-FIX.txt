TRUST BADGES + RETURN POLICY LINK + PAYMENT SECURITY — files in this zip
==========================================================================

WHAT CHANGED (1 file)
----------------------
app/product/[slug]/product-detail.tsx
  - The 3-icon trust badge row (Free Shipping / Authentic / Returns) now:
      1. Has a hover tooltip (title attr) on each badge explaining WHY it's
         true instead of being a bare unexplained label:
           - Free Shipping -> "Pan-India delivery, tracked from dispatch
             to your door."
           - Authentic -> "Sourced directly from handloom weavers across
             India -- no third-party resellers."
           - Returns -> uses the live admin-configured return window text
             (already pulled from Admin > Marketing > Shipping & Returns
             Timing via returnWindowBadgeText(fulfillment) -- unchanged
             logic, just now also explained in the tooltip).
  - Added a "Return Policy ->" text link directly below the badges,
    pointing to /legal/refund-policy (this route + its content already
    exist in your repo -- Admin > Marketing > Legal Pages -- this just
    surfaces it in human-readable text on the product page itself,
    not only inside the JSON-LD structured data that only Google reads).
  - Added a small "Secure payments via Razorpay" line with a lock icon,
    next to the Return Policy link, in the same row -- no fake "SSL
    Secured" badge, since Razorpay is the gateway actually wired up in
    app/checkout/page.tsx.
  - New icon import: `Lock` from lucide-react (added to the existing
    lucide-react import list at the top of the file).

DESIGN NOTES
------------
- Everything added lives INSIDE the existing trust-badge card (same
  border/bg/padding), just with one extra thin-bordered row underneath --
  no new section, no extra vertical space beyond ~32px, so mobile scroll
  length is basically unchanged.
- Text sizes (11px/10px) match the existing badge label size so it reads
  as one cohesive premium block, not a bolted-on afterthought.
- Return Policy link uses your primary brand color (text-primary) to look
  intentional/clickable; payment line stays muted/secondary since it's
  informational, not an action.

HOW TO APPLY
------------
1. Copy app/product/[slug]/product-detail.tsx from this zip into your
   repo at the same path (overwrite the existing file).
2. Commit and push:
     git add app/product/[slug]/product-detail.tsx
     git commit -m "feat: visible return-policy link + authentic/shipping tooltips + Razorpay trust line on product page"
     git push
3. Vercel/Netlify will redeploy automatically on push if connected,
   otherwise trigger a deploy manually.
4. Spot check on a live product page (mobile width) that:
     - Tapping/hovering a badge shows its explanation
     - "Return Policy ->" opens /legal/refund-policy with real content
     - The Razorpay line renders next to it, same row, no extra scroll
