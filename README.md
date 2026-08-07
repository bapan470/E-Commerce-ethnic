# Blog Analytics — self-hosted (Google Cloud/GA4 NAHI chahiye)

Views/Clicks/Conversions ab sirf aapke apne Supabase se aayenge — koi
Google Cloud Console, IAM, service account JSON kuch nahi chahiye.

## Kya hai is zip mein

| File | Kya karo |
|---|---|
| `supabase/migrations/20260808130000_blog_analytics_events.sql` | Naya table — Supabase SQL editor mein run karo (ya migration folder mein daal ke deploy) |
| `app/api/blog/track/route.ts` | NEW — public tracking endpoint |
| `app/api/admin/blog-performance/route.ts` | REPLACE — ab GA4 ki jagah Supabase se data leta hai |
| `app/api/razorpay/verify-payment/route.ts` | REPLACE — payment success pe conversion bhi log karta hai |
| `components/blog/blog-view-tracker.tsx` | NEW — page view track karta hai |
| `components/blog/blog-cta-button.tsx` | REPLACE — click track karta hai (ab gtag pe depend nahi karta) |
| `components/blog/blog-product-card.tsx` | REPLACE — click track karta hai |
| `app/blog/[slug]/page.tsx` | REPLACE — poori file, BlogViewTracker already wired hai |

## Ek cheez abhi bhi manually karni hai

`components/admin/blog-panel.tsx` mein Views/Clicks/Conversions columns —
pehle diye README ka "Patch 2" hi use karo, ab bhi wahi same hai
(response shape same rakha hai, koi change nahi).

## Steps

1. Supabase dashboard > SQL Editor mein migration file ka content paste
   karke Run karo (isse `blog_analytics_events` table ban jaayega).
2. Baaki saari files apne project mein same path pe copy/replace karo.
3. `git add . && git commit -m "self-hosted blog analytics (no GA4)" && git push`

## Test kaise karo

1. Deploy hone ke baad kisi bhi blog post ko open karo.
2. Supabase dashboard > Table Editor > `blog_analytics_events` kholo —
   1-2 second mein ek naya row (`event_type: view`) dikhna chahiye.
3. Uss post ka CTA button ya product card click karo — ek aur row
   (`event_type: click`) aana chahiye, turant.
4. Admin > Blog panel > Views/Clicks columns turant update ho jaayenge
   (GA4 wala 24-48h delay nahi hai — yeh real-time hai kyunki seedha
   apne database se aa raha hai).
5. Conversion test karne ke liye ek test order complete karo (agar
   Razorpay test mode hai) — payment verify hote hi ek
   `event_type: conversion` row aana chahiye, agar aapne pehle usi
   session mein koi blog post visit kiya ho.

## Note

Yeh "Views/Clicks/Conversions" hai — Google search mein "kitni baar dikha"
(impressions) is se alag cheez hai, woh Search Console se aati hai, na
GA4 se na is self-hosted system se. Agar future mein woh bhi chahiye,
Search Console setup GA4 se simpler hai (bas site verify karna hota hai,
IAM/service-account wala jhanjhat nahi) — bata dena.
