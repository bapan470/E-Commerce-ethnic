# Price Filter Bar (Shop by Price) — Apply Guide

## Kya add hua
Shop page (`/shop`) par ab category ki jagah/saath ek **scrollable "Shop by
Price" chip bar** hai — bilkul category-icons wali scroll style mein, bas
category ki jagah price ranges hain:

- Under ₹499
- ₹499 - ₹699
- ₹699 - ₹899
- ₹899 - ₹1000
- ₹1000 - ₹5000

Kisi bhi chip par tap karo → grid turant us price range ke products dikhayega
(same "Filters" logic jo already price slider use karta hai, bas ab ek tap
mein). Dobara tap karo ya "All Prices" dabao → filter clear ho jata hai.

**Admin se fully manage hota hai** — koi bhi price range add/edit/delete/
reorder kar sakte ho bina code chhue:
`Admin panel → Catalog → Price Filters`

Koi naya database table/migration nahi chahiye — yeh existing generic
`settings` table (jo already store info, banners, etc. ke liye use hota hai)
mein ek naya key (`price_range_filters`) store karta hai.

## Files (is zip mein)
- `lib/settings-api.ts` — **replace** (naya function add hua: end mein
  `PriceRangeBucket`, `fetchPriceRangeFilters`, `savePriceRangeFilters`)
- `app/shop/shop-content.tsx` — **replace** (naya "Shop by Price" bar add
  hua, category filter bar jaisi hi scroll style mein)
- `components/shop/price-range-filter-bar.tsx` — **naya file**
- `components/admin/price-range-filters-panel.tsx` — **naya file**
- `app/admin/page.tsx` — **replace** (naya panel register hua)
- `components/admin/admin-shell.tsx` — **replace** (sidebar mein "Price
  Filters" naya menu item add hua, Catalog group ke andar, Categories ke
  just neeche)

## Apply kaise karein

**Option A — Patch file (fastest, edited files ke liye):**
Repo root se (jahan `.git` folder hai):
```
git apply price-filter-update.diff
```
Isse `lib/settings-api.ts`, `app/shop/shop-content.tsx`, `app/admin/page.tsx`,
`components/admin/admin-shell.tsx` — ye 4 already-existing files apply ho
jayengi. Patch sirf edits track karta hai, naye files nahi — isliye niche
diye 2 naye components manually copy karne honge (Option B follow karo un
2 files ke liye):
- `components/shop/price-range-filter-bar.tsx`
- `components/admin/price-range-filters-panel.tsx`

**Option B — Sabhi files manually copy-paste (patch use nahi karna ho toh):**
1. Is zip ke andar jo bhi files hain, unko apne local repo
   (`E-Commerce-ethnic`) mein **same exact path** par copy-paste/replace
   karo (folder structure zip mein bhi wahi hai).
2. Phir:
   ```
   git add lib/settings-api.ts app/shop/shop-content.tsx app/admin/page.tsx components/admin/admin-shell.tsx components/shop/price-range-filter-bar.tsx components/admin/price-range-filters-panel.tsx
   git commit -m "feat: admin-managed 'Shop by Price' scrollable price-range filter bar"
   git push
   ```

(Maine patch ko ek fresh clone par `git apply --check` se verify bhi kar
liya hai — cleanly apply hota hai.)

## Test karne ke liye
1. `/shop` kholo — heading ke neeche, "Price Drop / Bestseller / Most
   Gifted" chips ke just neeche, "Shop by Price" bar dikhna chahiye,
   horizontally scrollable.
2. Kisi bhi price chip pe tap karo — sirf us range ke products dikhein
   (e.g. "Under ₹499" pe tap karo → sirf ₹100–₹499 wale products).
3. Admin panel kholo → left sidebar mein "Catalog" group ke andar
   "Price Filters" naya option dikhna chahiye. Wahan se koi range edit/add/
   delete/reorder karke save karo, phir `/shop` refresh karke check karo ki
   chip bar turant update ho gaya.

## Note
Maine already `npx tsc --noEmit` chala ke poore project mein 0 TypeScript
errors confirm kiye hain, toh yeh changes safely apply ho jaane chahiye.
