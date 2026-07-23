# Admin > Collections — naya feature

## Kya bana

**Admin sidebar me naya tab: "Collections"** (Catalog group me, Categories ke
neeche). Ye vendor collections se alag hai — ye poori tarah admin-managed
hain, koi vendor inhe touch nahi kar sakta.

Panel me hai:
- **"Add New Collection" button** — naam, slug (auto-generate hota hai naam
  se, chaho to manually bhi de sakte ho), description, Active/Inactive
  toggle, aur ek **product picker** (search + checkbox list) jisse products
  select karke collection me daal sakte ho.
- **Product count** — har collection row me kitne products hain wo dikhta
  hai.
- **Search box** — name/slug/description se filter.
- **Filter tabs** — All / Active / Inactive.
- Har collection ka apna public link `/collection/[slug]` bhi row me
  clickable hai.
- Edit aur Delete dono options hain (delete se sirf grouping hatti hai,
  products delete nahi hote).

## Kaise kaam karta hai (technical)

1. **Naya DB migration**: `supabase/migrations/20260814000000_admin_collections.sql`
   - `collections` table (id, name, slug, description, is_active, timestamps)
   - `collection_products` table (collection_id + product_id junction, with
     position for ordering)
   - Dono tables par RLS on hai lekin **koi public/authenticated policy nahi**
     — matlab sirf service-role (yani sirf `/api/admin/collections/*` jo
     admin-login cookie check karta hai) inhe touch kar sakta hai. Vendors
     table jaisa hi secure pattern.
   - **Isko bhi Supabase SQL editor me run karna hoga**, tabhi ye feature
     kaam karega (jaise pichli baar bataya tha vendor storefront migration
     ke liye).

2. **Admin API**: `app/api/admin/collections/route.ts` (list + create) aur
   `app/api/admin/collections/[id]/route.ts` (get one with product ids,
   update, delete). Dono admin-session cookie check karte hain — bina admin
   login ke koi bhi request 401 milegi.

3. **Public page reuse**: `/collection/[slug]` route (jo pichli baar vendor
   ke liye bana tha) ab **dono serve karta hai** — pehle vendor slug check
   karta hai, agar nahi mila to admin collection slug check karta hai (sirf
   Active collections dikhti hain, Inactive 404 dega). Same rating-total
   calculation (live reviews table se) admin collections ke liye bhi apply
   hoti hai — koi extra toggle nahi lagaya kyunki admin collection ka koi
   "vendor" nahi hai jiske liye hide karna ho.

## Files is zip me
```
app/admin/page.tsx                                  (Collections panel register kiya)
app/api/admin/collections/route.ts                  (naya)
app/api/admin/collections/[id]/route.ts              (naya)
app/api/collection/[slug]/route.ts                   (extended — admin collections bhi serve karta hai)
app/collection/[slug]/collection-page-client.tsx      (pichli baar se, no change is round)
app/collection/[slug]/page.tsx                        (pichli baar se, no change is round)
components/admin/admin-shell.tsx                      (naya sidebar item: Collections)
components/admin/collections-panel.tsx                (naya — poora UI)
components/admin/vendors-panel.tsx                    (pichli baar se)
components/product/product-carousel.tsx               (pichli baar se)
components/product/vendor-collection.tsx              (pichli baar se)
lib/admin-collections-api.ts                          (naya — client fetch helpers)
lib/types.ts                                          (naya AdminCollectionRow type add kiya)
lib/vendor-storefront-api.ts                           (pichli baar se)
supabase/migrations/20260814000000_admin_collections.sql   (naya — RUN KARNA ZAROORI HAI)
changes.diff                                          (poora diff, rename-aware)
```

## Apply kaise karein
```bash
git apply changes.diff
```
Fir zaroori: **Supabase SQL editor me `20260814000000_admin_collections.sql`
run karna na bhoolein**, warna Admin > Collections tab khulega lekin
save/list requests fail hongi.

```bash
git add -A
git commit -m "Add admin-managed Collections (separate from vendor collections)"
git push
```
