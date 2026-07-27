PER-PRODUCT DISCOUNTED PRICE AFTER COUPON (Cart Drawer)
============================================================

Ab jab coupon apply hota hai, sirf total mein nahi — cart ke HAR product
card ke "You Pay" ke neeche ek nayi line dikhti hai jo us specific
product ka after-coupon price dikhati hai. Exactly jaisa aapne screenshot
me dikhaya:

  🏷 ARUHI25 applied — you pay      ₹499  ₹474

FILES IN THIS ZIP (repo me isi path pe REPLACE karo):
  lib/coupons-api.ts          -> naya computeItemCouponDiscount() function
  components/cart-drawer.tsx  -> har product card me ye price line dikhati hai

KAISE CALCULATE HOTA HAI (fair rehta hai, total se match karta hai):
  - PERCENTAGE coupon (jaise 25% off): har product ka apna % discount
    milta hai — uske apne line total ka utna hi %.
  - FLAT coupon (jaise ₹100 off): jaisa checkout total mein bhi hota hai,
    flat discount HAR DISTINCT PRODUCT pe ek baar milta hai (quantity se
    matter nahi karta), us product ke total se zyada kabhi nahi.
  - Agar koi product coupon minimum order value ki wajah se qualify hi
    nahi karta (subtotal kam hai), to koi bhi line pe extra price nahi
    dikhegi — jaisa pehle wale fix mein already handle ho chuka hai.

APPLY:
  git add lib/coupons-api.ts components/cart-drawer.tsx
  git commit -m "Show per-product discounted price when a coupon is applied"
  git push

`tsc --noEmit` se poora project clean type-check ho chuka hai.
