CART DRAWER — LIVE COUPON PRICE + AVAILABLE COUPONS LIST
============================================================

FILE IN THIS ZIP (apne repo me isi path pe REPLACE karo):
  components/cart-drawer.tsx

KYA BADLA:

1) LIVE DISCOUNT PRICE (coupon applied hone ke baad):
   - "Price details" accordion ab coupon apply hote hi AUTO-OPEN ho jaata
     hai — shopper ko turant, bina click kiye, after-coupon total dikh
     jaata hai.
   - Checkout button ke UPAR ab ek naya prominent row hai jo sirf tabhi
     dikhta hai jab coupon applied ho: "<CODE> applied — you pay" ke
     saath original price (strikethrough) aur final discounted price —
     "You are saving" wale green strip ke bilkul saath, checkout se
     pehle aakhri cheez jo shopper dekhta hai.

2) AVAILABLE COUPONS LIST (jab koi coupon abhi tak apply nahi hua):
   - Admin > Coupons me jis coupon ka "Show on Product Page" toggle ON
     hai, wahi coupons ab cart drawer me bhi "Available Coupons" list ke
     roop me dikhte hain (bilkul product page jaisa card — code, %
     off/flat off, min order value, ek-click "Apply" button).
   - Ye list sirf tab dikhti hai jab koi coupon already applied NA ho.
     Jaise hi ek coupon apply ho jaata hai, list gayab ho jaati hai
     (kyunki apply karne ko kuch bacha hi nahi) aur uski jagah applied
     coupon + live discounted price dikhta hai.
   - Manual "Coupon code" type-karke apply karne wala option bhi as-is
     hai, list ke sirf sath extra hai, replace nahi kiya.

Koi naya database table/migration nahi chahiye — yeh feature existing
`coupons` table aur `show_on_product_page` column (jo already hai) use
karta hai, wahi jo product page pe "Available Coupons" dikhata hai.

APPLY:
  git add components/cart-drawer.tsx
  git commit -m "Show live post-coupon price + available coupons in cart drawer"
  git push

`tsc --noEmit` se poora project clean type-check ho chuka hai, koi build
error nahi.
