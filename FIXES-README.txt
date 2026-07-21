FIXES — README (Hinglish)
==========================

4 FILES change hue hain (sab same path par copy-overwrite karo):
  lib/stock-api.ts                        <- NAYI FILE
  app/checkout/page.tsx                   <- updated
  app/product/[slug]/product-detail.tsx   <- updated
  components/header.tsx                   <- updated

Verify kiya: npx tsc --noEmit -> clean. npx next lint -> koi NAYA
error/warning nahi (jo purane errors hain wo already tumhare repo mein
the, inn files se related nahi).

--------------------------------------------------------------
1) VARIATION PRODUCT STOCK CHANGE NAHI HO RAHA — asli wajah
--------------------------------------------------------------
Poore codebase mein dhoondne par pata chala: order place hone ke baad
kahin bhi stock_quantity kam nahi kiya ja raha tha — na base product
ka, na variant/size ka. Checkout sirf order row bana raha tha aur ruk
jaata tha. Isliye stock kabhi ghatta hi nahi tha, chahe kitne bhi order
aa jaayein (variation ho ya normal product, dono affected the — bas
tumne variation products mein zyada notice kiya).

Fix: naya file lib/stock-api.ts — jab bhi order successfully place hota
hai (COD turant, online payment success ke baad), ye har item ke liye:
  - agar item ka colour+size kisi variant se match karta hai, to us
    exact variant-size ka stock_quantity kam karta hai
  - product ka overall stock_quantity bhi hamesha sync mein kam karta
    hai (taaki plain product page aur admin ka low-stock list dono sahi
    dikhein)
  - 0 se neeche kabhi nahi jaata, aur stock 0 hone par in_stock
    automatically false ho jaata hai

app/checkout/page.tsx mein iska call add kiya — COD confirm hote hi,
aur online payment (Razorpay) success hone ke baad.

--------------------------------------------------------------
2) CHECKOUT SE BACK — VARIATION PRODUCTS PAR 2 CLICK / SWIPE SE KAAM
   NAHI KARTA THA
--------------------------------------------------------------
Asli wajah mili: product page par colour swatch badalne par
(handleSelectVariant) URL browser ke raw history.replaceState se
badla ja raha tha — isse address bar to update ho jaata tha, lekin
Next.js ka apna router ko pata hi nahi chalta ki route badal gaya hai.
Iss mismatch ki wajah se native back (hardware back button, edge-swipe
gesture, ya browser ka apna back button) kabhi kabhi ek tap mein page
chhod hi nahi paata tha — dusra tap lagta tha. Normal (non-variation)
products is bug se bache hue the kyunki wahan colour switch hota hi
nahi.

Fix (app/product/[slug]/product-detail.tsx): ab raw history hack ki
jagah Next.js ka apna router.replace(..., { scroll: false }) use hota
hai — isse Next ka router bhi sync mein rehta hai, page reload/refetch
bhi nahi hota (jaisa pehle tha), aur back navigation reliably 1 step
mein kaam karta hai.

Header (components/header.tsx) mein bhi ek extra safety-net add kiya:
pehle sirf apne back-arrow button ke click par hi "sahi page par jao"
logic chalta tha — hardware back / swipe gesture ise trigger hi nahi
karte the. Ab route change hone par (chahe kisi bhi tareeke se — apna
button, hardware back, swipe) yehi logic apne aap chalta hai aur agar
zaroorat pade to sahi page par correct kar deta hai. Isse "2 baar back
click karna padta hai" wala issue — chahe app ke andar wale button se
ho ya phone ke native back/swipe se — dono fix ho gaye.

--------------------------------------------------------------
3) BUY NOW SE BACK KARNE PAR CART SIDE DRAWER AB NAHI KHULEGI
--------------------------------------------------------------
Pehle jab Buy Now se checkout jaake back kiya jaata tha, code jaan-
boojhkar side cart drawer force-open kar deta tha (taaki item "lost"
na lage). Tumne clearly bola ki ye nahi chahiye — bas normal back jaisa
hi ho, drawer khud se na khule. Fix kar diya: ab item chhupke se real
cart mein safe rehta hai (kuch lose nahi hota), lekin drawer force-open
nahi hoti — bas seedha us page par wapas chale jaate ho jahan se aaye
the. Ye single product aur variation product — dono ke liye same
behavior hai ab.

--------------------------------------------------------------
IMPORTANT
--------------------------------------------------------------
Mere paas tumhare GitHub repo mein directly push karne ka access nahi
hai — maine sirf clone karke fix kiya hai (jaisa tumne khud zip
mangwaya). Upar diye 4 files apne repo mein same path par copy-paste
karke commit + push + redeploy karo.

Deploy karne ke baad thoda test karo:
  - ek variation product par colour badal ke Buy Now se checkout jao,
    phir hardware back / swipe se ek hi tap mein sahi page par aana
    chahiye, cart drawer khud se nahi khulni chahiye
  - order place karke (COD test se) product/admin panel mein stock
    number kam hua ya nahi check karo
