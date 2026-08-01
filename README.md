# BOGO Offer Badge + Unlocked Celebration + Cart Page Discount

## Update 2 — is round me kya fix hua

1. **"Already unlocked" par same message repeat hone ka fix (Bag drawer + Cart page)**
   Pehle jab shopper already 1 (ya zyada) free/discounted item unlock kar chuka hota
   tha, tab bhi top par wahi purana "Add X more qualifying items to unlock..." message
   dikhta rehta tha — jaise kuch unlock hi nahi hua. Ab:
   - Agar cart me **already koi free/discount item unlock ho chuka hai** → top par
     ek green celebration banner: **"🎉 Wow! You got N item(s) discount FREE — BOGO
     applied!"** + kitna ₹ discount already add ho gaya, dikhega.
   - Agar next free item ke liye aur items chahiye, to usi banner ke andar chhoti si
     extra line: "Add X more to unlock another FREE item!" bhi dikhegi — dono baatein
     ek sath, confusing nahi.
   - Agar **abhi tak kuch unlock nahi hua** (sirf progress hai) → wahi purana
     "Add X more to unlock" message dikhega (jaisa pehle tha).

2. **Cart page (`/cart`) par BOGO discount ab show hota hai**
   Pehle `/cart` full page ke Order Summary me sirf Coupon discount dikhta tha, BOGO
   discount kahin nahi dikhta tha (sirf Bag drawer aur Checkout me tha). Ab:
   - Total ke calculation me bogoDiscount bhi minus hota hai (pehle miss tha).
   - "X item(s) discounted (BOGO)" line Order Summary me Coupon discount ke sath dikhti hai.
   - Upar wahi celebration/progress banner bhi cart page par dikhta hai (Bag drawer jaisa).

## Pehle round me kya hua tha (still included)

- BOGO offer badge (jo product page/catalog pe "Buy X Get Y" dikhta hai) ab
  Bag drawer, `/cart` page, aur checkout order summary — teeno jagah har item
  pe dikhta hai **agar us product pe offer active hai**, warna nahi dikhta.

## Files is zip me

```
app/cart/page.tsx          (full replace)
app/checkout/page.tsx      (full replace)
components/cart-drawer.tsx (full replace)
CHANGES.diff                (git diff — reference ke liye, isse apply mat karo)
```

## Apply kaise karein

Apne local clone (`C:\Users\bapan\E-Commerce-ethnic`) me:

1. Is zip ko extract karo.
2. `app/cart/page.tsx`, `app/checkout/page.tsx`, `components/cart-drawer.tsx`
   — teeno files ko upar wale exact paths pe **replace** kar do.
3. `npm install` (agar pehle se node_modules hai to skip) → `npm run dev` se local test karo.
4. Sab sahi lage to:
   ```
   git add app/cart/page.tsx app/checkout/page.tsx components/cart-drawer.tsx
   git commit -m "Celebrate unlocked BOGO offer + show BOGO discount on cart page"
   git push
   ```

Koi database/schema change nahi hai — sirf UI files.

