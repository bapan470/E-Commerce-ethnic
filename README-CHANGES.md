# Vendor Collection — round 2 changes

## Kya-kya fix kiya

1. **URL rename: `/store/[slug]` → `/collection/[slug]`**
   `https://www.aruhihandlooms.com/store/pixtalemory-bdc385` ab
   `https://www.aruhihandlooms.com/collection/pixtalemory-bdc385` banega.
   - `app/store/` folder → `app/collection/` (page + client component renamed)
   - `app/api/store/[slug]/route.ts` → `app/api/collection/[slug]/route.ts`
   - Har jagah jahan `/store/...` link banta tha (admin panel, vendor
     collection widget, fetch call) — sab `/collection/...` par update kar
     diya.
   - **Note:** agar Google me pehle se `/store/...` URL index ho chuka hai
     ya kisi ne share kiya hai, to purana URL ab 404 dega (koi redirect
     set nahi kiya, kyunki abhi tak koi live traffic/SEO history nahi thi).
     Agar future me chahiye to `/store/[slug]` par ek redirect add kar sakte
     hain — bata dijiyega.

2. **Eyebrow label "COLLECTION" — jaise "BRIDAL" tag hota hai**
   - Product page ke "<Vendor>'s Collection" carousel me ab title ke upar
     chhota "COLLECTION" tag dikhega (bilkul "BRIDAL" jaisa style), aur
     title me sirf vendor ka naam dikhega (jaise product page pe "BRIDAL"
     ke neeche product ka naam hota hai).
   - **Dono (eyebrow tag + vendor naam) click karne par** `/collection/
     [slug]` par jaate hain — plus "View All" bhi wahi jaata hai.
   - Standalone collection page (`/collection/[slug]`) par eyebrow text
     "Vendor Collection" se badal ke sirf **"Collection"** kar diya, jaisa
     aapne bola.

3. **Total rating/review bug fix (asli wajah mil gayi)**
   Admin me toggle "Show rating/reviews on storefront" ON hone ke bawajood
   collection page par total rating/review nahi dikh raha tha — isiliye
   kyunki purana code sirf `products` table ke `rating`/`reviews` columns
   ka sum leta tha. Ye columns sirf **seed/placeholder values** hain jo
   tab tak dikhte hain jab tak product par koi asli review na ho — isi
   wajah se zyadatar products "0 reviews" dikhate hain, jabki asli reviews
   `reviews` table me store hote hain (jo single product page use karta
   hai, isi liye wahan sahi count dikhta tha).

   Ab collection page ka total bhi **`reviews` table se live data** leke
   calculate hota hai (approved reviews), aur jis product ka koi live
   review abhi tak nahi hai sirf uske liye seed value fallback hoti hai —
   exactly wahi logic jo single product page already use karta hai. Ab
   total sahi calculate hoke top pe dikhega.

## Files is zip me
```
app/api/collection/[slug]/route.ts        (naya — pehle /api/store/[slug]/route.ts tha)
app/collection/[slug]/page.tsx            (naya path)
app/collection/[slug]/collection-page-client.tsx  (naya path, renamed from store-page-client.tsx)
components/admin/vendors-panel.tsx
components/product/product-carousel.tsx
components/product/vendor-collection.tsx
lib/vendor-storefront-api.ts
changes.diff   -> full diff, git rename detection ke saath
```

## Apply kaise karein
Sabse aasaan tarika — apne local clone me:

```bash
git apply changes.diff
```

Agar `git apply` conflict de (kyunki aapne beech me kuch aur change kiya
ho), to manually in files ko overwrite kar dijiye, **aur purana folder
`app/store/` + `app/api/store/` delete kar dijiye** (naya `/collection`
path already inclusive hai, dono ek saath rakhne ki zaroorat nahi).

Phir normal tarike se:
```bash
git add -A
git commit -m "Rename vendor storefront to /collection, fix rating totals, add eyebrow tag"
git push
```
