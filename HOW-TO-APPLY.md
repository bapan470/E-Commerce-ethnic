# Free WhatsApp Abandoned-Cart Recovery — What Changed

4 files. Copy each one into your repo at the SAME path, overwriting the
existing file, then run the 1 SQL step in Supabase, then commit + push.

## Files (replace at these exact paths)

1. `supabase/migrations/20260827080000_add_phone_to_abandoned_carts.sql`
   → NEW file, just add it.
2. `app/api/cart-track/route.ts` → replaces existing file
3. `app/checkout/page.tsx` → replaces existing file
4. `components/admin/abandoned-carts-panel.tsx` → replaces existing file

## Steps

1. **Run the migration** — open Supabase Dashboard → SQL Editor → paste the
   contents of `supabase/migrations/20260827080000_add_phone_to_abandoned_carts.sql`
   → Run. (Just adds one `phone` column to `abandoned_carts`. Safe, no data loss.)

2. **Copy the 3 code files** into your local repo, overwriting the old ones.

3. **Commit + push**:
   ```
   git add .
   git commit -m "Add free WhatsApp (wa.me) abandoned-cart recovery"
   git push
   ```

4. Netlify/Vercel will auto-deploy. Once live:
   - New abandoned carts will start saving the shopper's phone number
     (existing/older abandoned carts won't have one — that's expected,
     they were captured before this change).
   - In Admin → Abandoned Carts, any cart with a phone number now shows a
     **"Send WhatsApp"** button next to "Send recovery email".
   - Clicking it opens `wa.me/91XXXXXXXXXX?text=...` in a new tab with the
     recovery message already typed in — you just tap Send from your own
     WhatsApp (Web or app, whichever you're logged into).

## Why this is 100% free

No WhatsApp Business API, no BSP (AiSensy/WATI/Interakt), no per-message
Meta billing. It's the same `wa.me` click-to-chat mechanism as a "Chat with
us" button, just pointed the other direction (business → customer) and
pre-filled with the recovery message. The only cost is your own time to
click "Send WhatsApp" + "Send" for each cart — nothing is automated/bulk.

If later you want it fully automatic (system sends without you clicking
anything), that requires the paid WhatsApp Business API — happy to help
wire that up separately when you're ready.
