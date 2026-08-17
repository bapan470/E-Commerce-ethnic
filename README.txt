Kya change hua (Hinglish):
1. lib/email-templates.ts -> naya function `orderStatusUpdateEmail` add kiya
   (pending/paid/shipped/delivered/cancelled/failed sabke liye alag email copy).
2. lib/orders-api.ts -> `updateOrderStatus()` ab order update karne se pehle
   customer_email fetch karta hai, aur status badalne par customer ko email
   bhejta hai (best-effort - email fail ho bhi to status update nahi rukega).
   Ye function Admin > Orders ke status dropdown se hi call hota hai, isliye
   ab HAR status change (cancelled, paid, delivered, etc.) par email jayega.
3. app/order-confirmation/[id]/page.tsx -> "Thank you" page par ab order ka
   live status (Pending/Payment Confirmed/Shipped/Delivered/Cancelled) ek
   badge ke roop me dikhta hai, jo admin ke status change ke turant baad
   reflect hoga (page refresh/dobara open karne par).

Apply kaise kare:
Option A (recommended, fast): apne project folder me jaake terminal me:
    git apply CHANGES.patch
  (agar conflict aaye to Option B use karein)

Option B (manual replace): is zip ke andar ke 3 files ko seedha apne
project ke same path par copy-paste/replace kar dein:
    - app/order-confirmation/[id]/page.tsx
    - lib/email-templates.ts
    - lib/orders-api.ts

Uske baad:
    git add -A
    git commit -m "Send email on every order status change + show live status on thank you page"
    git push

Note: Email bhejne ke liye Admin > Settings > Email Notifications me
provider (Resend ya ZeptoMail) already configured hona chahiye -- wahi
provider is naye status-change email ke liye bhi use hoga.
