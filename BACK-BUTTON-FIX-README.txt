BACK BUTTON FIX — README
=========================

Ye zip mein 2 files hain jo change hui hain. Inhe apne repo mein same path
par copy karke overwrite kar do:

  components/header.tsx
  app/product/[slug]/product-detail.tsx

--------------------------------
BUG: Back button 2 baar click karna padta tha
--------------------------------
Root cause: Ye project Next.js 13.5.1 (App Router) use kar raha hai. Is
version mein next/navigation ka router.back() kabhi kabhi sirf URL update
karta hai lekin page turant re-render nahi karta — isliye pehla click
"kuch nahi hua" jaisa lagta hai, aur dusra click tab jaake actually peeche
le jaata hai.

Fix (components/header.tsx):
  - Header ka back-arrow button ab router.back() ki jagah browser ka
    native window.history.back() use karta hai, jo Next.js ke internal
    route-cache ko bypass kar deta hai. Isse 1 hi click mein reliably
    peeche jaata hai.
  - Agar history bilkul khaali ho (jaise koi seedha /checkout link se
    aaya ho), tab hi router.back() par fallback karta hai.

Extra safety (app/product/[slug]/product-detail.tsx):
  - "Buy Now" button par ek guard laga diya hai taaki mobile par fast
    double-tap se checkout page do baar history mein na chala jaaye
    (jisse bhi back button "2 clicks" wala feel deta).

--------------------------------
Quantity +/- already implemented hai
--------------------------------
Checkout page (app/checkout/page.tsx) mein Order Summary section mein
har item ke niche already +/- quantity stepper hai (changeItemQuantity
function, line ~1105-1145). Ye Buy Now flow ke liye bhi already sahi se
kaam karta hai (updateBuyNowQuantity call hota hai jab item Buy Now wala
ho). Koi change nahi karna pada — agar tumhe checkout page par ye nazar
nahi aa raha, to pakka check karo ki latest code deployed hai.

--------------------------------
Bonus note
--------------------------------
`npm install` karte waqt ek warning aayi thi:
  "next@13.5.1: This version has a security vulnerability."
Jab time mile, Next.js ko ek patched version par upgrade karna consider
karo (breaking changes ho sakte hain App Router projects mein, isliye
alag se test karke karna).
