SAB CHANGES — ISS ZIP ME 5 FILES HAIN
========================================

PART 1 — Admin: Add Variant me sizes pre-select + "Add as variant" button
----------------------------------------------------------------------------
Files: components/admin/product-variants-manager.tsx
       components/admin/products-panel.tsx

- Naya colour/variant add karte waqt, product ke "Sizes" section me jo
  sizes tick hain wahi ab pre-fill hote hain (pehle hamesha "Free Size").
- Naya button "Add "<BaseColour>" as variant" dikhta hai (sirf jab: (a)
  product me 1 se zyada size ho, (b) base colour abhi tak real variant na
  ho). Click karte hi variant form pre-filled khulta hai.


PART 2 — Google Merchant Center price-mismatch FIX (final fix)
----------------------------------------------------------------------------
Files: app/api/merchant-feed/route.ts
       app/product/[slug]/page.tsx
       app/product/[slug]/product-detail.tsx

PROBLEM: Jab kisi colour ke andar alag-alag sizes ka alag price ho
(jaise XXL costlier), to feed har size ke liye ek alag <g:price> bhejta
tha -- lekin sab sizes ek hi product-page URL share karte the, jo hamesha
sirf PEHLE size ka price dikhata tha (structured data + visible price
dono). Google apne hi documentation me yeh exact scenario "price
mismatch" ka sabse bada karan batata hai:
  "If your product has variants such as different sizes, make sure the
   price in your data source corresponds to the price of the variant
   that is pre-selected when the page loads."
  "Where possible, assign unique URLs for each product variant to
   clearly define individual prices."

FIX (Google ki hi recommended approach use ki hai):
  1. Feed ab har size-item ke link me ?size=XL jaisa query param jodta
     hai (sirf un items ke liye jinka apna size-level price hai).
  2. Product page (client side) ab is ?size= param ko padhta hai aur
     load hote hi WAHI size pre-select karta hai (pehle hamesha pehla
     size select hota tha) -- isse visible price bhi turant sahi size
     ka dikhta hai.
  3. Product page ka structured data (JSON-LD <Offer>) bhi ab isi size
     ka exact price aur stock status use karta hai, feed ke number se
     hubahu match karte hue.

RESULT: Ab feed price, landing-page visible price, aur structured-data
price -- teeno HAMESHA match karenge, chahe kitne bhi sizes ka price
alag-alag kyun na ho. Yeh "price mismatch" disapproval risk poori tarah
khatam kar deta hai.

Agar aap per-size price hi use nahi karte (sab size same price), to yeh
fix chalte hue bhi kuch change nahi mehsoos hoga -- sab kuch pehle jaisa
hi kaam karega, bas extra safety hai.

HOW TO APPLY
------------
Option A (patch) -- sabse aasan, saari 5 files ek saath apply ho jayengi:
  1. all-changes-final.patch ko repo root me copy karo
  2. git apply all-changes-final.patch
  3. git diff se verify karo
  4. git add -A && git commit -m "Pre-select sizes on add-variant + fix GMC price-mismatch via per-size landing pages" && git push

Option B (manual replace):
  In 5 files ko unke exact same relative path par overwrite karo:
    components/admin/product-variants-manager.tsx
    components/admin/products-panel.tsx
    app/api/merchant-feed/route.ts
    app/product/[slug]/page.tsx
    app/product/[slug]/product-detail.tsx
  Phir commit + push.

DEPLOY KE BAAD
--------------
- Google Merchant Center me "Fetch now" karo (Feeds > apna feed >
  three-dot menu > Fetch now) taaki naye ?size= links turant use ho
  jayein, warna Google apne normal schedule (usually daily) tak purana
  feed hi use karega.
- Kuch din diagnostics check karte raho -- "Mismatched value (price)"
  warnings gayab honi chahiye purani entries ke liye bhi jaise hi Google
  naya feed + naya crawl kar leta hai.
