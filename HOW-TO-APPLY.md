# Checkout item row — MRP crossed-out + sale price, same line

## Kya change hua
`components/checkout/sticky-order-bar.tsx` — expanded order summary me har
item ki price ab ek hi line me dikhti hai: **₹2,200 (crossed) ₹1,388**.
Pehle ye do lines me stacked thi (MRP upar, sale price niche).

## ⚠️ Zaroori — data check
Ye sirf layout fix hai. Crossed-out MRP (₹2,200) **tabhi dikhega jab us
product ka MRP field, price se zyada set ho** (Admin panel → Products →
us product ko edit karo → MRP field check/set karo). Agar MRP set nahi hai
ya price ke barabar/kam hai, to sirf sale price (₹1,388) dikhega — jo already
sahi behavior hai (jab discount hai hi nahi to crossed price dikhana galat
hoga).

## Apply kaise karein
1. Zip extract karo.
2. `components/checkout/sticky-order-bar.tsx` ko apne repo me **usi path**
   par replace karo.
   — Ya —
   `git apply checkout-item-mrp.patch` chala do repo root se.
3. `git add -A && git commit -m "Show item MRP crossed-out inline with sale price at checkout" && git push`

Koi migration ya naya package nahi chahiye.
