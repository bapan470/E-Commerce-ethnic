# How to apply these changes

This zip mirrors your repo's exact folder structure — copy these files
straight into `E-Commerce-ethnic/`, overwriting the existing ones, then
run the new migration and push.

## Files included (7 changed, 2 new)

**Changed:**
- `app/api/admin/vendors/bank-update/route.ts` — also copies `upi_id` on approve
- `app/api/vendor/bank-update/route.ts` — accepts optional `upi_id`
- `app/api/vendor/route.ts` — accepts structured address fields, composes `pickup_address`
- `app/sell-with-us/page.tsx` — Pickup Address is now Address Line 1/2 + City + State + Pincode
- `app/vendor/dashboard/page.tsx` — adds UPI ID field + a "KYC Documents" card/link
- `components/admin/vendors-panel.tsx` — shows city/state/pincode + UPI in admin view
- `lib/vendor-api.ts` — updated types, `cache: 'no-store'` on profile fetch

**New:**
- `app/vendor/login/page.tsx` — convenience redirect (see note below)
- `supabase/migrations/20260812000000_phase1b_address_upi.sql` — new columns + updated RPC

`CHANGES.diff` is the full unified diff if you'd rather review/apply it with `git apply`.

## Steps

1. Copy the files into your repo (same relative paths), overwriting existing ones.
2. Run the new migration: `supabase db push` (or paste the SQL file into the Supabase SQL editor).
3. `git add -A && git commit -m "Structured pickup address, UPI ID, KYC dashboard link" && git push`

## About each of your 5 points

1. **`/vendor/login` 404** — this wasn't actually a bug in your app. Vendors
   have always logged in through the normal `/login` page (same as
   customers) — there was never a `/vendor/login` route. That was a wrong
   path in a testing-checklist I gave you earlier, sorry about that. I've
   added a tiny redirect page anyway so the URL doesn't 404 if it's ever
   bookmarked or shared.

2. **Pickup address as a real address form** — done. Now Address Line 1
   (required), Address Line 2 (optional), City, State, Pincode
   (6-digit validated). Behind the scenes it's still combined into the
   single `pickup_address` string your courier/notification code already
   reads, so nothing else had to change.

3. **UPI ID option** — added to the vendor dashboard's Bank Details
   card, and it goes through the exact same `pending_bank_update` →
   admin-approval flow as account number/IFSC — no separate/extra
   verification step, as you asked.

4. **KYC upload option** — this already existed (Phase 5A) at
   `/vendor/dashboard/kyc`, and the admin panel already reviews it per
   vendor. It just wasn't very visible from the main dashboard page, so
   I added a "KYC Documents" card there that links straight to it.

5. **"Bank detail already approved, but dashboard not showing it"** —
   I read through the actual approve-route and dashboard-fetch code
   carefully and didn't find a bug: the approve action correctly copies
   the values across, and the dashboard fetch correctly reads the live
   row. My best guess is the "Bank Update Requests (0)" count you saw is
   actually **correct** — once a request is approved, it's cleared from
   that pending list by design, that's not a failure. I did add an
   explicit `cache: 'no-store'` to the profile fetch just to remove any
   possible doubt about stale data. After applying this update, please:
   - Refresh the vendor dashboard and confirm the masked account number
     now shows correctly.
   - If it's *still* showing `–` after a hard refresh, that means the
     approval didn't actually go through on that specific vendor — check
     the Supabase `vendors` table row for that vendor directly
     (`bank_account_number` column) to confirm, and let me know what you
     see there so I can dig further with the actual data instead of
     guessing.
