CHANGE SUMMARY
==============

File changed:
  app/product/[slug]/product-detail.tsx

What changed:
  Variant (colour) pages ab apna khud ka in-stock status compute karte hain
  (variant ke saare sizes ka stock_quantity add karke), base product ke
  inStock flag ko blindly inherit karne ke bajaye. Isse "Notify me" form
  variant pages par bhi sahi se trigger hota hai jab wo variant out of
  stock ho, chahe base product in-stock ho.

  Pehle: product.inStock hamesha baseProduct.inStock tha, variant ke
  sizes ka stock consider nahi hota tha.

HOW TO APPLY
=============
1. Apne local project mein ye file replace karo:
     app/product/[slug]/product-detail.tsx
   (isi zip ke andar same path pe hai — bas copy-paste/overwrite karo)

2. git add, commit, push:
     git add app/product/[slug]/product-detail.tsx
     git commit -m "fix: compute variant-level in-stock status for Notify Me"
     git push

SQL — kya run karna hai?
=========================
Is fix ke liye koi NAYI SQL migration zaroori NAHI hai — maine sirf
frontend logic change ki hai, database schema same hai.

Maine reference ke liye supabase/migrations/20260719000000_phase9_discovery.sql
bhi is zip mein daal di hai (aapke repo mein already maujood hai). Ye
"stock_notifications" table banati hai jisme Notify-me signups store hote
hain. Agar aapne apne Supabase project par ye migration ABHI TAK run nahi
ki, tabhi ise Supabase SQL editor mein run karna — agar already ho chuki
hai to kuch mat karo, ye sirf reference ke liye hai.
