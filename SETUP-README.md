# Phase 7 — Returns/Refunds Admin + Email Notifications + Cart Recovery

## 1. Files kaise replace karein
Yeh zip sirf **naye aur badle hue files** ka hai (poora project nahi). Apne local project folder
(`E-Commerce-ethnic`) ke andar isi folder structure ke saath extract/copy kar do — same paths pe
overwrite/create ho jayenge:

- `supabase/migrations/20260718000000_returns_refund_amount.sql`  → NEW
- `lib/email.ts`                                                  → NEW
- `lib/email-templates.ts`                                        → NEW
- `vercel.json`                                                   → NEW
- `app/api/order-confirm/route.ts`                                 → NEW
- `app/api/cart-track/route.ts`                                    → NEW
- `app/api/cron/abandoned-carts/route.ts`                          → NEW
- `app/api/admin/returns/route.ts`                                 → NEW
- `app/api/admin/returns/[id]/route.ts`                            → NEW
- `app/api/admin/abandoned-carts/route.ts`                         → NEW
- `app/api/admin/abandoned-carts/[id]/send/route.ts`               → NEW
- `components/admin/returns-panel.tsx`                             → NEW
- `components/admin/abandoned-carts-panel.tsx`                     → NEW
- `app/api/admin/delhivery/create-shipment/route.ts`               → REPLACE (shipped email added)
- `app/admin/page.tsx`                                             → REPLACE (2 new tabs added)
- `app/checkout/page.tsx`                                          → REPLACE (email tracking + confirm email)

## 2. Supabase mein SQL run karna hoga
Supabase Dashboard → SQL Editor → naya query → is file ka poora content paste karke Run karo:

`supabase/migrations/20260718000000_returns_refund_amount.sql`

Yeh sirf `returns` table mein 2 columns add karta hai (`refund_amount`, `resolved_at`) — koi existing
data delete/change nahi hota, safe hai.

(`returns` aur `abandoned_carts` tables already tumhare DB mein hain — unhe dobara banane ki zarurat nahi.)

## 3. Environment variables (.env aur Vercel Project Settings dono mein add karo)

```
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=Saaj Boutique <onboarding@resend.dev>
CRON_SECRET=koi_bhi_random_secret_string
NEXT_PUBLIC_SITE_URL=https://your-vercel-domain.vercel.app
```

- `RESEND_API_KEY` — https://resend.com pe free account bana ke API key lo.
- `EMAIL_FROM` — jab tak apna domain verify nahi karte, `onboarding@resend.dev` use karo — lekin
  ismein sirf woh email address pe deliver hoga jisse tumne Resend account banaya hai. Real customers
  ko bhejne ke liye apna domain Resend mein verify karna padega.
- `CRON_SECRET` — koi bhi random string; Vercel Cron isse automatically header mein bhejta hai.
- `NEXT_PUBLIC_SITE_URL` — cart recovery email ke "Complete your purchase" button ke link ke liye.

## 4. Vercel Cron — Hobby/Free plan
Tum Hobby (free) plan pe ho, jahan cron sirf **din mein ek baar** chal sakta hai. Isliye
`vercel.json` mein schedule ab **roz raat 3:00 AM IST (21:30 UTC)** pe set kar diya hai
(`"30 21 * * *"`) — jab traffic sabse kam hota hai.

Iska matlab: jo bhi cart 1+ ghante se abandoned hai, use is daily run ke time recovery email
milega (turant nahi, roz ek baar batch mein). Agar future mein zyada frequent (hourly) recovery
chahiye ho, to Vercel Pro plan lena hoga, ya ek free external cron service (jaise cron-job.org)
use karke `https://your-domain.vercel.app/api/cron/abandoned-carts` ko har ghante
`Authorization: Bearer <CRON_SECRET>` header ke saath hit karwa sakte ho — code already isko
support karta hai, sirf trigger ka source badalta hai.

**Vercel pe deploy karne ke baad ek baar zaroor check karo:** Project → Settings → Cron Jobs
mein yeh entry dikhni chahiye. Agar nahi dikh rahi to `vercel.json` root folder mein hi hona
chahiye (jahan `package.json` hai) — ismein woh already hai.

## 5. Kya-kya naya kaam karega
- **Order confirmation email** — COD ya online payment, dono ke baad customer ko automatically email jayega.
- **Shipped email** — jab admin "Create Shipment" karega, customer ko tracking number ke saath email jayega.
- **Returns/Refunds admin processing** — Admin → "Returns" tab: status change (approved/rejected/refunded/completed),
  refund amount aur note daal sakte ho — save karte hi customer ko email chala jayega.
- **Abandoned cart recovery** — checkout page pe jaise hi customer email type karta hai (cart khali nahi ho),
  1.5 second baad background mein track ho jata hai. 1 ghante baad bhi order complete nahi hua to cron job
  automatically recovery email bhejega. Admin → "Abandoned Carts" tab se manually bhi "Send recovery email" kar sakte ho.
