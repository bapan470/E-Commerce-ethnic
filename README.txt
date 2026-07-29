CHANGES INCLUDED IN THIS ZIP
=============================

1) "Add Variant" ab sizes pre-select karta hai
------------------------------------------------
Naya color/variant add karte waqt, ab wahi sizes automatically pre-fill
hote hain jo aapne main product ke "Sizes" section me tick kiye hain
(pehle hamesha sirf "Free Size" se start hota tha).

2) Naya button: Add "<BaseColour>" as variant
------------------------------------------------
Product ka apna base colour (jo "Colours" field me pehla naam hai, e.g.
"White") normally kabhi ek real variant row nahi banta -- isliye uska
size-wise price/stock alag se edit nahi ho pata tha.

Ab "Colour & size variants" section me ek naya button dikhega:
   Add "White" as variant
   (button me white ki jagah aapka asli base-colour ka naam aayega)

Yeh button SIRF tabhi dikhega jab:
   - Product me ek se zyada size selected ho (Free Size akela ho to
     button nahi dikhega -- single-size product ko per-size pricing
     ki zaroorat nahi hoti)
   - Base colour abhi tak real variant ke roop me add nahi hua ho
Ek baar base colour ko variant bana doge (ya woh already ek variant ho),
yeh button apne aap gayab ho jayega -- duplicate add nahi hone dega.

Click karte hi "Add Variant" form khulega jisme:
   - Colour naam pehle se bhara hoga (product ka base colour)
   - Product image pehle se laga hoga
   - Har size ki row already ban chuki hogi (Stock=3, Price khali)
   - "Set as default colour" already tick hoga
Aapko bas har size ka Price/Stock check/bhar ke "Add Variant" dabana hai.

Note: Colour-name match karke duplicate "White, White" swatch product
page par nahi banta -- yeh pehle se hi safe-guarded hai (case-insensitive
match by colour name), is change se koi naya risk nahi bana.

Files changed (2):
  - components/admin/product-variants-manager.tsx
  - components/admin/products-panel.tsx

HOW TO APPLY
------------
Option A (patch):
  1. size-preselect-changes.patch ko repo root me copy karo
  2. git apply size-preselect-changes.patch
  3. git diff se verify karo
  4. git add -A && git commit -m "Pre-select sizes + one-click convert base colour to variant" && git push

Option B (manual replace):
  Dono .tsx files ko same relative path par overwrite karo, phir commit+push.
