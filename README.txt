BUG FIX — COUPON STAYS "APPLIED" ON A CART THAT NO LONGER QUALIFIES
========================================================================

PROBLEM (jo aap describe kar rahe the):
  899 wale product pe ARUHI50 apply kiya (min order value pura hota tha).
  Phir 485 wala product add kiya aur 899 wala hata diya. Ab cart me sirf
  485 ka product bacha — jo coupon ke "orders above ₹X" minimum se kam
  hai — phir bhi ARUHI50 "applied" dikhta reh gaya.

ROOT CAUSE:
  Discount amount already sahi tha (₹0 ho jaata tha jab subtotal min
  order value se neeche chala jaata), LEKIN coupon khud "applied" state
  se kabhi remove nahi hota tha — sirf uska discount 0 ho jaata tha. Isse
  UI me coupon tag/badge "attached" dikhta rehta tha (jaise abhi bhi kaam
  kar raha ho), jabki actually koi discount nahi mil raha tha.

FIX:
  lib/cart-context.tsx me ek naya check add kiya: jab bhi cart ka
  subtotal, applied coupon ke minimum order value se neeche chala jaaye,
  coupon AUTOMATICALLY remove ho jaata hai — aur ek toast message dikhta
  hai: '"<CODE>" removed — your cart total dropped below the ₹X minimum
  required for this coupon.'

  Ab aisa nahi hoga ki coupon "chipka hua" dikhe kisi aise product ke
  saath jispe wo qualify hi nahi karta — jaise hi cart is minimum se
  neeche jaata hai, coupon turant hat jaata hai aur shopper ko clearly
  bata diya jaata hai kyun.

FILE IN THIS ZIP (repo me isi path pe REPLACE karo):
  lib/cart-context.tsx

APPLY:
  git add lib/cart-context.tsx
  git commit -m "Fix: auto-remove coupon when cart falls below its minimum order value"
  git push

`tsc --noEmit` se poora project clean type-check ho chuka hai.
