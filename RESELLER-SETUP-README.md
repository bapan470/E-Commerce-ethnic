# Reseller Program — Setup Guide (v2: resale at checkout)

Same account/login reselling — now built directly into checkout, like you asked.

## How it works now
1. On the **checkout page**, a logged-in customer sees a **"Resell this product"** checkbox.
2. Ticking it opens a **Yes / No popup**: "Mark this as a resale order?"
3. **Yes** → reveals a margin % field (pre-filled from their saved default) and an optional
   **brand name** field. The order total updates live and turns **green**, showing the price
   their own customer should pay.
4. **No** → checkbox un-ticks, nothing changes.
5. They fill in their customer's name/phone/address (the normal checkout fields) and place the
   order as usual (COD or online) — **you ship directly to that address**.
6. Their reseller profile is created automatically the first time they do this (same login, no
   separate signup).
7. `/account/reseller` is now just a **dashboard**: earnings summary, default margin setting, and
   their resale order history. The old "Place a New Order" form has been removed — that's all done
   at checkout now.
8. **Admin → Orders**: any resale order shows an amber **"Resale"** badge under the customer name
   (with brand name if given), plus the margin % and reseller's profit on that order.
9. **Admin → Resellers**: unchanged — lists every reseller, their totals, suspend/reactivate.

## Files in this zip (copy over your repo, same paths — overwrite existing ones)
```
supabase/migrations/20260728000000_reseller_program.sql   ← run this migration (if not already)
supabase/migrations/20260729000000_reseller_brand_name.sql ← NEW migration, run this too

lib/reseller-api.ts                        ← UPDATED
app/checkout/page.tsx                      ← UPDATED (resale checkbox + popup + margin/brand + green price)
app/account/reseller/page.tsx              ← UPDATED (dashboard only, no order form)
components/admin/orders-panel.tsx          ← UPDATED (Resale badge)

app/api/reseller/route.ts                  ← unchanged from v1
app/api/reseller/orders/route.ts           ← unchanged from v1 (kept as an API; UI no longer calls it, safe to keep)
app/api/admin/resellers/route.ts           ← unchanged from v1
components/admin/resellers-panel.tsx       ← unchanged from v1
components/admin/admin-shell.tsx           ← unchanged from v1
app/admin/page.tsx                         ← unchanged from v1
components/account/account-nav.tsx         ← unchanged from v1
app/account/orders/page.tsx                ← unchanged from v1
```

## Setup steps
1. Copy all files above into your project at the same paths (overwrite existing ones).
2. Run **both** migrations on Supabase (SQL Editor → paste → Run, or `supabase db push`):
   - `20260728000000_reseller_program.sql` (skip if you already ran it from v1)
   - `20260729000000_reseller_brand_name.sql` (new — needed for the brand name field)
3. Restart dev server / redeploy.
4. `git add . && git commit -m "Resale at checkout" && git push`

## Test it
1. Log in as a customer, add a product to cart, go to checkout.
2. Tick **"Resell this product"** → click **Yes** on the popup.
3. Set a margin (e.g. 25), optionally a brand name.
4. Watch the total turn **green** and update.
5. Fill your (test) customer's name/phone/address, place the order.
6. Go to `/account/reseller` → see it in "Your Resale Orders" with profit shown.
7. Go to Admin → Orders → the order should show the amber **"Resale"** badge.

## Notes
- Pricing is still **server-side safe** where it matters: the base product price always comes from
  your `products` table; margin is applied only in the browser for display/total calculation, same
  as your existing coupon/loyalty/tax math already works in this checkout page.
- Payment stays COD or your existing Razorpay online flow — the amount charged is simply the
  marked-up (resale) total instead of the normal total when resale is ticked.
