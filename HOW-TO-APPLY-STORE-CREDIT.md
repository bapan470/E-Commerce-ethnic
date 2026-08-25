# Store Credit — Header Integration

Ye zip me sirf naye/changed files hain (poora repo nahi). In files ko apne
repo ke **same relative paths** par copy/replace kar do, phir commit + push.

## Files in this zip

| File | Kya hai |
|---|---|
| `supabase/migrations/20260928000000_store_credit.sql` | Naya `store_credits` (balance) + `store_credit_ledger` (history) table, RLS ke saath |
| `lib/store-credit-api.ts` | Client-side functions: balance fetch, history, redeem, admin adjust |
| `app/api/store-credit/redeem/route.ts` | Checkout par balance apply karne wala server route |
| `app/api/admin/store-credit/route.ts` | Admin panel se customer ko credit issue/adjust karne wala route |
| `app/account/store-credit/page.tsx` | Customer-facing `/account/store-credit` page (balance + history) |
| `components/header.tsx` | **Header me Wallet icon + ₹ amount badge** (desktop icon row + mobile menu) |
| `components/account/account-nav.tsx` | Account sidebar/mobile-tabs me "Store Credit" link add kiya |
| `store-credit.patch` | Same changes ek single git patch ke roop me (`git apply store-credit.patch`) |

## Apply karne ke 2 tareeke

### Option A — Files copy karke (simple, GUI se bhi)
1. Zip extract karo.
2. Har file ko apne local repo me **usi path** par paste/replace karo
   (e.g. `components/header.tsx` → `E-Commerce-ethnic\components\header.tsx`).
3. `git add -A && git commit -m "Add store credit to header" && git push`

### Option B — Patch apply karke (terminal)
```bash
cd E-Commerce-ethnic
git apply --check store-credit.patch   # dry run, error na aaye to next line chalao
git apply store-credit.patch
git add -A
git commit -m "Add store credit to header"
git push
```

## Deploy se pehle zaroori step

⚠️ **Supabase migration run karna mat bhoolna**, warna balance/header errors
throw karega (table exist hi nahi karega):

```bash
supabase db push
```
(ya Supabase Dashboard → SQL Editor me `20260928000000_store_credit.sql`
ka content paste karke run karo.)

## Ye kaise kaam karta hai

- Header me, login hone par (`useAuth()` se `user` milne par) ek **Wallet icon
  + ₹ balance** dikhta hai (desktop icon row me Wishlist se pehle, aur
  hamburger/mobile menu me "Store Credit" row me badge ke roop me).
- Logged-out users ko ye bilkul nahi dikhta.
- Balance `lib/store-credit-api.ts` ke `fetchMyStoreCredit()` se aata hai,
  jo Supabase RLS ke through sirf apna hi balance read kar sakta hai.
- `/account/store-credit` par poori history dikhti hai.
- Admin `POST /api/admin/store-credit` (email + amount) call karke kisi bhi
  customer ko refund/goodwill credit de sakta hai — abhi UI nahi banaya,
  sirf backend route hai (chaho to Admin panel me ek tab bana ke isko wire
  kar sakte hain, jaise Gift Cards tab hai).
- Checkout par redeem karne ke liye `redeemStoreCredit(amountDue)` function
  ready hai (`lib/store-credit-api.ts`) — checkout page me abhi UI se
  connect nahi kiya, wo agla step hoga agar chahiye ho.

## Note

`node_modules` na hone ki wajah se main is environment me `npm run build` /
`tsc` chala ke type-check nahi kar paya — maine sab kuch existing
gift-cards/loyalty patterns follow karke likha hai (same imports, same auth
helpers), lekin push karne se pehle ek baar locally `npm run build` chala
lena safe rahega.
