# BOGO Offer Badge — Cart, Bag Drawer & Checkout

## Kya change hua

Pehle "Buy X Get Y" (BOGO) offer badge sirf **product page** aur **catalog/shop grid**
(`components/product-card.tsx`) pe dikhta tha. Ab wahi badge in jagah bhi dikhega,
**agar us specific product pe offer active hai** — nahi to badge simply nahi dikhega
(koi hardcoded/fake badge nahi, same logic jo product card use karta hai):

1. `components/cart-drawer.tsx` — side "Bag" panel (jo aapke screenshots me tha)
   → har item ke Size/Colour line ke neeche badge.
2. `app/cart/page.tsx` — full `/cart` page → har item ke Category/Size line ke neeche badge.
3. `app/checkout/page.tsx` — Order Summary list on checkout page → har item ke Size
   line ke neeche chhota badge.

## Kaise kaam karta hai

Sabhi 3 jagah pe same helper functions use kiye hain jo already
`lib/cart-context.tsx` me maujood the aur product-card.tsx use karta hai:

- `getVisibleBogoPromotion(productId, activePromotions)` → check karta hai ki
  ye product kisi active, "show badge" wali BOGO promotion me qualify karta hai ya nahi.
- `formatBogoLabel(promotion)` → "Buy 2 Get 1 Free" jaisa label banata hai.

Isliye:
- Agar product pe offer hai → badge dikhega (exactly wahi text jo product page/catalog pe hai).
- Agar product pe offer nahi hai → badge bilkul nahi dikhega.
- Admin panel se agar kisi collection ka "Show Buy X Get Y badge" toggle off hai,
  to wahan bhi badge nahi dikhega (same rule product card follow karta hai).

## Files is zip me

```
app/cart/page.tsx          (full replace)
app/checkout/page.tsx      (full replace)
components/cart-drawer.tsx (full replace)
CHANGES.diff                (git diff — reference ke liye, isse apply mat karo)
```

## Apply kaise karein

Apne local clone (`C:\Users\bapan\E-Commerce-ethnic`) me:

1. Is zip ko extract karo.
2. `app/cart/page.tsx`, `app/checkout/page.tsx`, `components/cart-drawer.tsx`
   — teeno files ko upar wale exact paths pe **replace** kar do.
3. `npm install` (agar pehle se node_modules hai to skip) → `npm run dev` se local test karo.
4. Sab sahi lage to:
   ```
   git add app/cart/page.tsx app/checkout/page.tsx components/cart-drawer.tsx
   git commit -m "Show BOGO offer badge on cart, bag drawer and checkout"
   git push
   ```

Koi database/schema change nahi hai — sirf UI files.
