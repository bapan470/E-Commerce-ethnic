# Checkout — crossed-out original price next to final price

## Kya change hua
`components/checkout/sticky-order-bar.tsx` — checkout ke top wali collapsed
bar me ("1 item · You save ₹167 · ₹1,221") ab final price (₹1,221) ke
**left me original price (₹1,388) crossed-out** dikhta hai. Data pehle se
hi checkout page se aa raha tha (`mrpTotal` prop) — sirf display missing
tha, wo add kar diya.

## Apply kaise karein
1. Zip extract karo.
2. `components/checkout/sticky-order-bar.tsx` ko apne repo me **usi path**
   par replace karo.
   — Ya —
   `git apply checkout-strike-price.patch` chala do repo root se.
3. `git add -A && git commit -m "Show crossed-out MRP next to checkout total" && git push`

Koi migration ya naya package nahi chahiye — sirf ye ek file.
