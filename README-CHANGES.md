# Trustpilot review-invitation integration (JavaScript Integration)

## Kya add hua

1. **`app/layout.tsx`** — Trustpilot ka "base" registration script har
   page ke `<head>` me add kar diya (integration key `En3UPwL5Q09ZQO2G`,
   jo aapne screenshot me dikhaya tha, hardcode kar diya hai — ye secret
   nahi hai, GA measurement ID jaisa public hi hota hai).
   Ye script sirf `window.tp()` register karti hai — koi widget nahi
   dikhati, koi email khud nahi bhejti.

2. **`components/analytics/trustpilot-invitation.tsx`** — naya component,
   bilkul `PurchaseTracker` (jo already GA4 ke liye use ho raha tha) jaisa
   pattern follow karta hai:
   - Order-confirmation page load hote hi `tp('createInvitation', {...})`
     call karta hai, customer ka real email/name/order-id bhejke.
   - `sessionStorage` se guard hai — same order page refresh karne se
     dobara invite nahi bhejega.
   - Agar Trustpilot ki base script thodi der se load ho (afterInteractive),
     to 10 second tak retry karta hai, GA4 wale tracker jaisa hi.
   - Agar order me email hi nahi hai to kuch nahi karta (guest/edge case).

3. **`app/order-confirmation/[id]/page.tsx`** — `PurchaseTracker` ke
   bagal me `TrustpilotInvitation` add kar diya, order ka real
   `customer_email`, `customer_name`, `id` pass karke.

## Kya NAHI badla

- Aapka apna site review system (product page ka "Reviews" tab, Supabase
  me store hone wale reviews, admin approval flow) — bilkul waisa hi hai,
  koi chhed-chhad nahi.
- Koi existing script/component delete/replace nahi hua — sirf naya add
  hua hai.

## Test kaise karein

1. Deploy karne ke baad koi bhi test order place karo (COD bhi chalega).
2. Order confirmation page khulte hi browser console me
   (`window.tp`) available hona chahiye.
3. Trustpilot Business dashboard → **Invitations** → **Invitation history**
   me jaake dekho — us order ka ek queued invitation dikhna chahiye
   (email turant nahi jaati, Trustpilot ke default delay ke baad jaati
   hai — dashboard me settings me delay/timing change kar sakte ho).

`tsc --noEmit` aur `eslint` dono in files ke saath clean pass ho gaye
(ek pre-existing warning hai layout.tsx me Meta Pixel ke `<img>` tag pe,
uska is change se koi lena dena nahi hai).
