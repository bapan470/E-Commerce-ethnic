# Collections product picker — variations + existing-promotion badge

## Kya add hua

1. **Har product ki colour variations picker me dikhengi**
   - `components/admin/collections-panel.tsx` me har product row ke saamne ek chevron (▶) hai — agar us product ki 1 se zyada colour hain (base + `product_variants`), to click karke expand kar sakte ho.
   - Expand hone par har colour apne swatch/photo ke saath ek checkbox me dikhta hai — kisi bhi colour ko untick kar sakte ho, matlab wo colour is collection me nahi jayega, baaki colours + product collection me rahenge.
   - Product ka main checkbox off karne par uski saari variation-choices bhi ignore ho jati hain (poora product hi collection se bahar).

2. **"Buy X Get Y" badge — pehle se covered products pe**
   - Picker active promotions fetch karta hai (`/api/promotions/active`).
   - Agar koi product pehle se kisi live "Buy X Get Y" promotion me cover ho raha hai (scope = 'all', ya scope = 'collection' jiski product-list me ye product hai), to uske naam ke saamne ek amber badge dikhta hai — jaise "🎁 Buy 2 Get 1".
   - Isse aap galti se same product ko doosri BOGO collection me dobara select nahi karoge.

## Files jo change hue

- `supabase/migrations/20260909000000_collection_product_variant_exclusions.sql` — **NAYA MIGRATION**. `collection_products` table me `excluded_variant_slugs text[] NOT NULL DEFAULT '{}'` column add karta hai. Isse koi existing row/behaviour break nahi hota (default empty array = pehle jaisa, sab variations included).
- `app/api/admin/collections/route.ts` — POST (create collection) ab `variant_exclusions` payload accept karke store karta hai.
- `app/api/admin/collections/[id]/route.ts` — GET (edit dialog load) ab `variant_exclusions` bhi return karta hai; PUT (save) ab isse store karta hai.
- `lib/admin-collections-api.ts` — types/functions update, `variant_exclusions` field add.
- `lib/types.ts` — `Product` type me naya `variant_list` field (per-variant slug/color/image), taaki admin UI har colour ko alag se address kar sake.
- `lib/products-api.ts` — `mapRowToProduct()` ab `variant_list` populate karta hai.
- `components/admin/collections-panel.tsx` — poora UI change: expand/collapse variations, per-colour checkboxes, promotion badge.

## IMPORTANT — migration chalana zaroori hai

Push karne ke baad, Supabase project par ye migration file zaroor chalao (SQL editor me paste kar do, ya `supabase db push` / migration workflow jo aap use karte ho):

```sql
ALTER TABLE collection_products
  ADD COLUMN IF NOT EXISTS excluded_variant_slugs text[] NOT NULL DEFAULT '{}';
```

Isके bina PUT/POST `/api/admin/collections*` errors dega (column not found), kyunki naya code is column ko likhne/padhne ki koshish karega.

## Scope note (jo isme included NAHI hai)

- Ye feature sirf **Admin > Collections ke "product picker" (Add/Edit Collection dialog)** ke liye hai — jaisa screenshot me dikhaya tha.
- Public collection page (`/collection/[slug]`) abhi bhi poora product hi dikhata hai; kisi specific excluded colour ko storefront grid se chhupane wala logic add nahi kiya, kyunki colour-variants storefront-wide ek global product attribute hain (sirf ek collection ke andar chhupana product ke baaki jagah (shop/category/home) dikhne se conflict karta, aur `/api/collection/[slug]` abhi variant list fetch bhi nahi karta). Agar aapko wo bhi chahiye, bata dena — alag se scope karna padega.
- Poore project ka `tsc --noEmit` aur `eslint` clean pass ho gaya hai in files ke sath.

