Part 2b — BOGO discount wired into cart state + UI
====================================================

Files changed (drop these into your repo, same paths):
- lib/cart-context.tsx        -> fetches active promotions on mount, computes
                                  bogoDiscount via computeBogoDiscount(), exposes
                                  activePromotions + bogoDiscount from CartContext.
- components/cart-drawer.tsx  -> Total = subtotal - couponDiscount - bogoDiscount.
                                  New "BOGO offer applied: -₹X" line in Price details,
                                  next to the coupon line, same styling. Savings strip
                                  and payment-discount base updated too.
- app/checkout/page.tsx       -> Same total formula. Buy Now flow recomputes
                                  bogoDiscount locally (mirrors how couponDiscount is
                                  already recomputed for Buy Now) since it checks out
                                  buyNowItem, not the persistent cart. New "BOGO offer
                                  applied" line in the order summary sidebar.

Also included: part2b.patch — a git diff of all three files, in case you'd rather
apply it with `git apply part2b.patch` from your repo root instead of copying files.

Verified: `npx tsc --noEmit` passes with 0 errors across the whole project after
these changes.

Test before pushing:
1. npm run dev
2. Make sure at least one active promotion exists with scope='all' (or 'collection'
   matching a product you'll test with).
3. Add 2+ qualifying items to the cart (enough to satisfy buy_qty + get_qty).
4. Open the cart drawer -> Price details -> confirm "BOGO offer applied: -₹X" shows
   with the correct amount, and Total reflects it.
5. Go to checkout with those same cart items -> confirm the same line + total in the
   order summary sidebar.
6. Try "Buy Now" on a single qualifying product with quantity >= buy_qty+get_qty (or
   add checkout-bump extras that push it over) to confirm the Buy Now path recomputes
   correctly too.
7. git add -A && git commit -m "Part 2b: wire BOGO discount into cart state + UI" && git push
