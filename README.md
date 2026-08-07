# Auto Product-Card Insertion — Setup

Yeh 2 files aapke existing AI blog generator ko extend karti hain taaki
generate hote hi 1-2 **real product cards** (real photo, price, "Shop Now")
khud-ba-khud post ke andar aa jayein — conversion badhane ke liye. Koi naya
table, koi naya env var, koi naya AI provider nahi — bas aapka existing
NVIDIA-based generator thoda smarter ban gaya hai.

## Kya badla

### `app/api/admin/generate-blog-post/route.ts`
AI se draft aane ke baad (jaise pehle se `suggested_cover_image` pick hota
hai waise hi), ab yeh:
1. Us post ke `related_category_name` se milte-julte **live, in-stock**
   products dhundhta hai (jinke paas real image hai).
2. Cover image wale product ko chhod kar (repeat na ho), 1-2 products pick
   karta hai — chhoti post me 1, badi (6+ paragraph) post me 2.
3. Un products ke `{{product:slug}}` markers ko post ke beech me,
   naturally spread karke daal deta hai — yeh wahi marker syntax hai jo
   aapke admin panel ka "Insert product card" button pehle se manually
   likhta hai, isliye `app/blog/[slug]/page.tsx` bina kisi change ke isse
   automatically real `<BlogProductCard>` (photo + price + Shop Now) me
   render kar dega.

### `components/admin/blog-panel.tsx`
Sirf ek chhota UI change — jab AI draft generate ho, toast message me ab
yeh bhi dikhega ki kaunse products auto-inserted hue, taaki aapko pata chale
ki AI ne khud se product images use ki hain.

## Setup steps

1. In dono files ko apne repo me same path par **replace** karein:
   - `app/api/admin/generate-blog-post/route.ts`
   - `components/admin/blog-panel.tsx`
2. Kuch bhi naya env var ya migration nahi chahiye — ho gaya.
3. Deploy karke Admin → Blog → "Generate with AI" try karein. Draft me ab
   product card(s) already body ke beech me insert mile honge (review dialog
   me textarea me `{{product:your-product-slug}}` line dikhegi).
4. Publish karne se pehले aap chahen to inserted product hata/badal sakte
   hain — normal text edit ki tarah, kyunki yeh sirf ek text marker hai.

## Kaise conversion badhta hai
- Product card real photo + price + discount + "Shop Now" button ke saath
  dikhta hai, seedha post ke content ke beech me — reader ko scroll karke
  neeche jaane ki zaroorat nahi.
- Har click already `blog_analytics_events` table me track ho raha hai
  (`cta_type: 'product_card'`) — aap `/api/admin/blog-performance` se dekh
  sakte hain kaunsa post/product sabse zyada convert kar raha hai.
- Sirf **live aur in-stock** products hi pick hote hain, isliye kabhi bhi
  "out of stock" ya dead product link nahi dikhega.
