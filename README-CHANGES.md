# BOGO product page → "You may also like" shows that BOGO collection

## Kya chahiye tha

Jab koi shopper kisi "Buy X Get Y" wale product ki page kholta hai, uski
"You may also like" section abhi generic same-category products dikhati
thi. Ab agar us product par koi live BOGO promotion chal rahi hai, ye
section us promotion ki collection ke baaki products dikhayegi — taaki
customer aasani se ek aur qualifying item add karke offer poora kar sake.

## Kya badla

1. **`app/api/promotions/active/route.ts`** — har active promotion ke
   saath ab uski collection ka `collection_slug` bhi return hota hai
   (pehle sirf `product_ids` aata tha). Isse frontend "View All" link
   seedha `/collection/[slug]` par bhej sakta hai.
2. **`lib/promotions-api.ts`** — `ActivePromotion` type me `collection_slug`
   field add kiya.
3. **`components/product/related-products.tsx`** — do naye optional prop
   add kiye: `overrideProducts` (agar diya aur khaali nahi hai, to normal
   same-category scoring ki jagah yahi list dikhegi) aur `viewAllHref`
   (View All link override). Kuch na diya jaye to bilkul purana behaviour
   (same-category "You may also like" + `/shop?category=...`).
4. **`app/product/[slug]/product-detail.tsx`** —
   - `useCart()` se `activePromotions` liya.
   - Current product ka live BOGO promotion nikala (`getVisibleBogoPromotion`
     — wahi rule jo shop-grid ka badge use karta hai).
   - Agar promotion scope='collection' hai, uski collection ke baaki
     products (current product hata ke) nikale.
   - `RelatedProducts` ko ye products + collection ka View All link + ek
     naya title ("Complete your Buy 2 Get 1 offer") pass kiya.
   - Agar current product par koi BOGO nahi hai (ya scope='all' hai, jiska
     apna collection nahi hota), to "You may also like" bilkul pehle jaisa
     hi behave karega (same-category matches, category link).

## Test kaise karein

1. Ek aisa product kholo jo "Buy X Get Y" collection ka member ho
   (screenshot me "Cotton Saree with Pink Pompom Details" jaisa).
2. Scroll karke "You may also like" dekho — ab title "Complete your Buy 2
   Get 1 offer" (ya jo bhi qty ho) dikhna chahiye, aur products usi
   collection ke honge, "View All" us collection ki page par le jayega.
3. Koi normal (non-BOGO) product kholo — "You may also like" bilkul pehle
   jaisa (same-category) dikhna chahiye.

`tsc --noEmit` aur `eslint` dono in files ke saath clean pass ho gaye.
