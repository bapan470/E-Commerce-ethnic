# Is zip mein 3 alag fixes hain

## 1) Colour switch instant (sizes/stock bhi background mein prefetch)
Files:
- `lib/variant-prefetch-cache.ts` (naya)
- `components/product/variant-swatches.tsx` (replace)
- `app/product/[slug]/product-detail.tsx` (replace)

Kya karta hai: jo variation pehle open hota hai wahi turant dikhta hai
(pehle se tha). Baaki sab colours ka poora data (photos + sizes/stock)
ab idle time mein background mein prefetch hoke cache ho jata hai, taaki
swatch click karne par turant switch ho — koi network wait nahi.

## 2) Blur Placeholder toggle — ab turant sync hota hai (bina hard refresh)
Files:
- `app/api/settings/blur-placeholder/route.ts` (naya)
- `components/blur-placeholder-sync.tsx` (naya)
- `app/layout.tsx` (replace)

Problem tha: Admin mein toggle off karne ke baad bhi shimmer dikhta
rehta tha (swatches, shop/category grid, kabhi-kabhi product image par
bhi) — jab tak user hard refresh na kare. Wajah: root layout ka
`beforeInteractive` script sirf **ek baar** (pehli full page load par)
value set karta hai; App Router mein layout dubara nahi chalta jab user
site ke andar links click karke navigate karta hai, so purani value hi
stuck reh jaati thi.

Fix: ek naya lightweight public API (`/api/settings/blur-placeholder`)
+ ek client component (`BlurPlaceholderSync`, root layout mein mount
kiya) jo **har page navigation par** background mein current value check
karke `window.__BLUR_PLACEHOLDER_ENABLED__` ko refresh kar deta hai —
bina kisi hard reload ke.

## 3) Colour switch par gallery ka slide/photo mismatch
File:
- `components/product/product-gallery.tsx` (replace)

Problem tha: colour switch karne par kabhi-kabhi galat photo dikhti thi
(jaise "1/5" number sahi dikhta lekin actual photo 4th wali dikhti) —
jitna aap purani colour ki gallery mein scroll kar chuke the, utna hi
door naye colour ki gallery mein bhi land ho jaate the.

Wajah: gallery mein colour switch (`images` array change) par 2 alag
`useEffect` fire hote the — ek index ko 0 par reset karta, doosra native
scroll position ko purane (stale) index ke hisaab se set kar deta, kyunki
`setActive(0)` turant apply nahi hota, agle render mein hota hai. Dono ek
saath race karte the.

Fix: dono effects ko ek mein merge kar diya — ab index aur scroll
position dono ek saath, hamesha `0` par reset hote hain, koi race nahi.

## Apply kaise karein
Har file apne repo mein **same relative path** par replace/add kar dein
(jaise is zip mein structure hai), phir:

```
git add lib/variant-prefetch-cache.ts \
        components/product/variant-swatches.tsx \
        "app/product/[slug]/product-detail.tsx" \
        app/api/settings/blur-placeholder/route.ts \
        components/blur-placeholder-sync.tsx \
        app/layout.tsx \
        components/product/product-gallery.tsx
git commit -m "Instant variant switch, fix blur-placeholder toggle staleness, fix gallery slide mismatch on colour switch"
git push
```

Koi migration, env var, ya naya dependency nahi chahiye. Type-check
(`tsc --noEmit`) is repo par clean pass ho chuka hai in sab files ke
saath — vahi step tha jo pehle Vercel build par fail hua tha.
