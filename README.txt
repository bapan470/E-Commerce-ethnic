Ratings vs Reviews — separate counts (product page review box)
================================================================

2 files, replace at the same paths:

  lib/reviews-api.ts
  components/product/reviews-section.tsx

What changed
------------
Pehle: "Ratings" aur "Reviews" dono same number dikhate the (summary.total),
kyunki har review row me rating hamesha hoti thi.

Ab: automatic split, real submitted reviews se hi -- koi naya DB column
ya admin field nahi chahiye:

  - RATINGS = saare approved reviews jinme sirf star diya gaya (comment ho
    ya na ho) -- summary.totalRatings
  - REVIEWS = un me se jinhone title ya comment likha (likha hua text hai)
    -- summary.totalReviews

Star breakdown bars (Excellent/Very Good/Good/Average/Poor) still totalRatings
ke against calculate hote hain -- kyunki wo distribution har rating ka hai,
sirf likhe hue reviews ka nahi.

Note: agar future me photos-only (bina text) submissions ko bhi "Review" me
count karna ho, to lib/reviews-api.ts me `hasWrittenContent` function me
`|| r.photos.length > 0` add kar dena -- abhi sirf title/comment text ko
"written review" mana gaya hai.

How to apply
------------
1. Unzip, copy these 2 files into your project at the same relative paths.
2. git add -A && git commit -m "Split ratings vs reviews count" && git push

Verified: `npx tsc --noEmit` and `next lint` both pass clean.
