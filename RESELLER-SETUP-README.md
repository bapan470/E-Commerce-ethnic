# Reseller Program — Setup Guide

This adds a Meesho-style reselling feature to your store, using the **same
customer login/email** — no separate reseller signup.

## How it works
- Any logged-in customer can click "Become a Reseller" (new page: `/account/reseller`).
- They set their own margin % (e.g. 20%). Selling price = your price × (1 + margin/100).
- They place orders for their own customers (name, phone, address) from that dashboard.
- **You still pack & ship every order** — it lands in your normal Admin → Orders list, just tagged as a reseller order.
- Their profit = what their customer paid − your base price. Tracked automatically.
- Admin → Resellers tab shows every reseller, their sales, their profit, and lets you suspend/reactivate anyone.

## Files in this zip (copy over your repo, same paths)
```
supabase/migrations/20260728000000_reseller_program.sql   ← NEW (run this migration)
lib/reseller-api.ts                                        ← NEW
app/api/reseller/route.ts                                  ← NEW
app/api/reseller/orders/route.ts                            ← NEW
app/account/reseller/page.tsx                                ← NEW
app/api/admin/resellers/route.ts                             ← NEW
components/admin/resellers-panel.tsx                          ← NEW

components/account/account-nav.tsx     ← MODIFIED (adds "Reseller" link)
components/admin/admin-shell.tsx       ← MODIFIED (adds "Resellers" admin tab)
app/admin/page.tsx                     ← MODIFIED (wires the new tab)
app/account/orders/page.tsx            ← MODIFIED (hides reseller orders from personal order history)
```

## Setup steps
1. Copy all files above into your project at the same paths (overwrite the modified ones).
2. Run the new migration on your Supabase project:
   - Supabase Dashboard → SQL Editor → paste contents of `20260728000000_reseller_program.sql` → Run
   - OR if you use the Supabase CLI: `supabase db push`
3. Restart your dev server / redeploy.
4. Test: log in as any customer → sidebar → "Reseller" → Become a Reseller → place a test order.
5. Check Admin → Resellers to see it listed.

## Notes / things to know
- **No trademark issues** — this is fully custom-built for your store, no Meesho branding or copied code anywhere.
- **Payment model (MVP)**: orders default to Cash on Delivery / manual reconciliation — the reseller's customer pays on delivery (or however you currently collect COD), and you settle the margin with your reseller separately. If you want online payment splitting (customer pays online, reseller's cut auto-deducted), that's a bigger addition (payment gateway payout/split) — let me know and I can build that next.
- Reseller pricing is always recalculated **server-side** from your real product price — a reseller can't tamper with the base cost from the browser.
- A reseller can be suspended anytime from Admin → Resellers without deleting their account/orders.
