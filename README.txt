DESIGN CHANGES — how to apply
==============================

Replace these 5 files in your repo with the ones in this zip (same folder paths):

1. components/header.tsx
   - Shop, Cart, and Checkout pages now show a back arrow (top-left, mobile
     only) instead of the hamburger menu, so users can step back easily.

2. components/mobile-bottom-nav.tsx   [NEW FILE]
   - Bottom tab bar (Home / Categories / Offers / Account), shown only on
     the home page, mobile only — like the Nykaa-style bottom nav.

3. components/providers.tsx
   - Wires the new bottom nav in, only on the home page ("/").

4. app/shop/page.tsx
   - Added "Price Drop / Bestseller / Most Gifted" quick-filter chips right
     under the page heading (tap to sort by that).
   - The Filters + Sort row is now a sticky bar fixed to the bottom of the
     screen on mobile (goes back to its normal inline position on desktop).

5. app/product/[slug]/product-detail.tsx
   - The regular inline "Add to Cart" button is now hidden on mobile —
     only the existing sticky bottom Add to Cart bar shows there.
   - Desktop is unchanged (no sticky bar there, so the regular button stays).

Nothing else was touched — no other files, no styling tokens, no logic
outside what's described above.

How to apply:
- Just copy these 5 files into your project at the same paths, overwriting
  the existing ones (mobile-bottom-nav.tsx is new, just add it).
- Run `npm install` if you haven't, then `npm run dev` / `npm run build` as usual.

Verified with `npx tsc --noEmit` — no type errors.
