# Fix: Buy X Get Y badge frontend pe purana (stale) dikhna

## Asli wajah (root cause)

`/api/promotions/active` — jo frontend product card aur product page ye check
karne ke liye call karte hain ki kisi product par abhi koi live "Buy X Get Y"
chal raha hai ya nahi — is route me koi `cookies()`/`headers()` use nahi ho
raha tha. Next.js (App Router) aise GET routes ko by default **cache kar
deta hai** (Full Route Cache) — matlab deploy hone ke baad jo pehla response
aaya, wahi baar baar sabko serve hota rehta hai, jab tak koi naya deploy na ho.

Isi wajah se:
- Aapne "Cotton Handloom Saree..." ko "Buy 2 Get 1" collection se
  unselect/save kar diya (jo backend me sahi se ho bhi gaya — DB update ho
  chuka tha),
- Lekin frontend product card is purane cached response se badge padh raha
  tha, isliye "Buy 2 Get 1" dikhna band nahi hua.

Same class ka issue `/api/collection/[slug]` (collection ka public page) aur
`/api/collections` (homepage "Shop by Collection" list) me bhi tha.

## Fix

Teeno routes me `export const dynamic = 'force-dynamic';` add kar diya —
ab ye har request par Supabase se fresh data padhenge, kabhi purana cached
response nahi denge:

- `app/api/promotions/active/route.ts`
- `app/api/collection/[slug]/route.ts`
- `app/api/collections/route.ts`

## Note

`/api/admin/collections*` routes already theek the (cookies() use karte hain
admin-auth check ke liye, jo Next.js ko automatically dynamic bana deta hai)
— issi liye Admin panel me changes turant DB me save ho rahe the, sirf
public-facing badge/collection routes purana data serve kar rahe the.

Is fix ke baad, product/collection edit karke save karte hi frontend par
turant sahi (fresh) data dikhega — koi extra deploy/cache-clear ki zaroorat
nahi.

`tsc --noEmit` aur `eslint` dono in files ke saath clean pass ho gaye.
