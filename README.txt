Rating & Review — split into two clear steps
==============================================

4 files -- 1 new, 3 replaced. Copy at the same relative paths:

  lib/reviews-api.ts                                  (replace)
  components/product/reviews-section.tsx              (replace)
  components/account/delivered-item-review.tsx         (NEW file)
  app/account/orders/[id]/page.tsx                     (replace)

No DB migration needed -- the `reviews` table's UPDATE policy already
allows a user to update their own row (checked in
supabase/migrations/20260717000000_full_feature_schema.sql).

What changed
------------

1. Product page ("Reviews" tab) -- Rate this product / Write a review
   Ab do saaf steps mein bant gaya hai:

   Step 1 -- "Rate this product": sirf stars + "Submit Rating" button.
   Star tap karke submit karte hi rating turant save ho jaati hai (koi
   title/comment zaroori nahi).

   Step 2 -- "Write a review" (optional, alag button se khulta hai):
   title + comment + photos, apni already-saved rating ke saath. Ye same
   review row ko UPDATE karta hai (naya function `updateMyReview` in
   lib/reviews-api.ts) -- naya review nahi banta.

   Left panel ab teen states dikhata hai:
     - Koi rating nahi di -> "Rate this product" button
     - Rating di, likha kuch nahi -> "You rated this X★" + "Add a written
       review" button
     - Likha hua review bhi hai -> "You reviewed this product" /
       "awaiting approval" (jaisa pehle tha)

   Written content add/update hone par review dobara `is_approved: false`
   ho jaata hai -- naya text bhi ek baar admin se moderate hokar hi
   dikhega (rating khud turant count ho jaati hai, kyunki wo already-
   approved trigger se turant products.rating me sync hoti hai).

2. Account > Orders > [order] -- delivered order ke har item ke neeche
   ek chhota inline widget (naya component
   components/account/delivered-item-review.tsx):

     - Order "delivered" hone par har item ke neeche turant "Rate this
       product" stars dikhte hain -- ek tap = rating submit.
     - Rating dene ke baad wahi widget "Add a written review" prompt
       dikhata hai (same rate -> review order, jaisa aapne bola).
     - Already likha hua review hai to "You reviewed this product" /
       "awaiting approval" dikhta hai.

   Sirf un items ke liye dikhta hai jinke paas item.product_id ho (naye
   orders me already hai -- app/checkout/page.tsx already product_id
   bhejta hai). Bahut purane orders jinme product_id save nahi hua tha,
   unme ye widget nahi dikhega (koi error nahi aayega, bas silently
   skip ho jaata hai).

How to apply
------------
1. Unzip, copy these 4 files into your project at the same relative
   paths (delivered-item-review.tsx is a brand-new file).
2. git add -A && git commit -m "Split rating and written review into two steps" && git push

Verified: `npx tsc --noEmit` and `next lint` both pass clean on all 4 files.
