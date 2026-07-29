CHANGE: Variant "Add Variant" size pre-select
================================================

Problem: Jab aap kisi product me naya color/variation add karte the,
size list hamesha sirf "Free Size" se start hoti thi — chahe aapne
main product ke "Sizes" section me XS, S, M, L, XL jo bhi tick kiya ho.

Fix: Ab jo sizes aapne product ke "Sizes" field me select kiye hain
(comma-separated string, e.g. "Free Size, S, M, L, XL"), wahi sizes
naye variant/color add karte waqt automatically pre-fill ho jayenge
(stock=3, price/SKU blank rahega, aap edit kar sakte hain).

Files changed (2):
  1. components/admin/product-variants-manager.tsx
  2. components/admin/products-panel.tsx

HOW TO APPLY
------------
Option A (recommended) - apply the patch:
  1. Copy "size-preselect-changes.patch" into the root of your cloned repo.
  2. Run:  git apply size-preselect-changes.patch
  3. Verify with: git diff
  4. Commit & push:
       git add -A
       git commit -m "Pre-select product sizes when adding a new colour variant"
       git push

Option B - manual replace:
  Just replace these 2 files in your repo with the ones in this zip
  (same relative paths):
    components/admin/product-variants-manager.tsx
    components/admin/products-panel.tsx
  Then commit & push as above.

NOTE ON YOUR SECOND QUESTION (size price kaha dalu)
----------------------------------------------------
Is repo ke structure me PRICE hamesha VARIANT (colour) level par set
hoti hai, main product par size-wise price ka koi alag field nahi hai.
  - Product ka base/default price      -> "Price" field (main product form)
  - Har colour ka apna price           -> variant ke "Price" field
    (blank chhodo to product ke price se inherit hoga)
  - Ek hi colour ke andar kisi size ka
    alag price (e.g. XXL costlier)     -> wahi size row ka
                                          "Price (₹, optional)" box
                                          (yeh aapko dikh bhi raha hai
                                          screenshot me) — blank chhodo to
                                          colour/product price use hoga.
So agar plain size-wise price chahiye without colour, sabse aasan tarika:
ek hi variant/colour bana lo (jaise product ka main colour), aur uske
andar har size row me apna price bhar do.
