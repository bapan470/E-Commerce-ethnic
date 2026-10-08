# Abandoned-cart link se coupon auto-apply

Changed files (same paths pe replace karo, phir git push):
- lib/cart-context.tsx
- lib/email-templates.ts
- components/cart/redirect-to-cart.tsx
- components/admin/abandoned-carts-panel.tsx
- app/cart/page.tsx

Koi migration / env change nahi chahiye.

## Kya hota hai ab
- Email ka "Complete your purchase" button -> /cart?coupon=CODE (click tracking ke through). Cart khulte hi coupon auto-apply.
- WhatsApp link -> /cart-link/<id>?coupon=CODE -> /cart, coupon auto-apply.
- Store 1 order = 1 coupon support karta hai, isliye jo coupon pehle se applied hai (jaise ARUHI75) usse
  ye silently replace nahi karta: dono me se jisme zyada bachat ho wahi rakhta hai, aur toast me batata hai.
- Cart khali ho (naye browser/phone me link khola) to code save rehta hai (3 din) aur item add karte hi apply hota hai.
- Cart page pe applied coupon ke saamne "Try another code" aaya.
