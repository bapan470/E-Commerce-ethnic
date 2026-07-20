DESIGN + FUNCTIONALITY CHANGES — how to apply
================================================

This zip has the COMPLETE current version of every changed/new file — it
includes everything from before (bottom nav, back button, quick filters,
sticky Add to Cart) PLUS this round's changes below. Just copy all 7 files
into your repo at the same paths, overwriting the existing ones.

Files in this zip:
  components/header.tsx
  components/mobile-bottom-nav.tsx   [new]
  components/providers.tsx
  app/shop/page.tsx
  app/product/[slug]/product-detail.tsx
  app/login/page.tsx
  lib/cart-context.tsx

What's NEW in this round
-------------------------

1. Back button on the product page too (components/header.tsx)
   - showBackButton now also matches /product/* routes, so product pages
     get the same left-of-logo back arrow as shop/cart/checkout.

2. Fixed the gap under the sticky Filters/Sort bar (app/shop/page.tsx)
   - The bar had a stray margin-bottom left over from before it became a
     fixed bottom bar — margin doesn't apply cleanly to a fixed bottom-0
     element, so it was leaving a visible empty strip below it. Removed
     the margin on mobile (kept only for the static desktop layout).
   - Same fix applies to every /shop view, including filtered category
     views (?category=...), since they're all the same page component.

3. Login page redesigned + Email OTP added (app/login/page.tsx)
   - On mobile it now shows as a bottom sheet (rounded top card anchored
     to the bottom, brand panel behind it) like the reference screenshots.
     Desktop keeps the previous centered-card layout, unchanged.
   - Added a "Password" / "Email OTP" toggle. Email OTP sends a one-time
     code to the shopper's email (Supabase's signInWithOtp) and verifies
     it (verifyOtp) — no password needed. Google login and the existing
     email/password login both still work exactly as before.
   - Note: this is EMAIL OTP, not mobile-number/SMS OTP. Phone OTP needs
     an SMS provider (e.g. Twilio) configured on the Supabase project
     itself — that's an account-level setup on Supabase's side, not
     something a code change alone can turn on. Email OTP works out of
     the box with your existing Supabase project.

4. Stock-aware quantity limits (lib/cart-context.tsx + product-detail.tsx)
   - Cart quantity (product page, cart page, cart drawer) is now capped at
     the product's actual stock_quantity. If only 1 is in stock, a second
     one can't be added or incremented to — the shopper gets a toast
     ("Only 1 unit in stock") and the + button disables at the limit.
   - This is centralized in the cart context, so it applies everywhere
     quantity can change (product page, cart page, cart drawer) from one
     change, not three separate ones.

Verified with `npx tsc --noEmit` — no type errors.
Nothing else was touched — no other files, no styling tokens, no logic
outside what's described above.
