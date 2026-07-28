FAVICON UPLOAD FEATURE — INSTRUCTIONS (Hinglish)
==================================================

Kya change hua (2 files):
---------------------------
1) components/admin/marketing-panel.tsx
   Admin panel > Marketing > SEO tab me pehle sirf ek plain text
   "Favicon URL" input tha. Ab wahan:
     - "Upload favicon image" button — seedha computer se image
       (PNG/JPG/WEBP/SVG/ICO) choose karke upload kar sakte ho.
     - Upload Supabase Storage ('product-images' bucket) me jaata hai
       aur favicon_url apne aap set + save ho jata hai.
     - Preview thumbnail + "Remove favicon" button.
     - Neeche ek chhota fallback input bhi hai agar manually URL
       paste karna ho.

2) app/icon.tsx
   Favicon size 32x32 se badhakar 48x48 kar diya, kyunki Google
   Search results me favicon dikhane ke liye minimum 48x48px square
   image chahiye hoti hai — 32x32 bahut chhota hai, Google usse
   ignore kar sakta hai.

Kaise apply karein:
--------------------
1) Is zip ke dono files ko apne repo ke same path par REPLACE kar
   dijiye:
     components/admin/marketing-panel.tsx
     app/icon.tsx

2) Phir apne terminal me:
     git add components/admin/marketing-panel.tsx app/icon.tsx
     git commit -m "Add favicon upload UI + bump favicon size for Google Search"
     git push

(Ya "changes.patch" file se bhi apply kar sakte ho: git apply changes.patch)

IMPORTANT — Google Search results me favicon kab dikhega:
------------------------------------------------------------
Upload karte hi sirf aapki site ka favicon set hota hai (browser tab
me turant dikhega). Lekin GOOGLE SEARCH RESULTS me favicon dikhne ke
liye Google ko site dobara crawl/index karna padta hai — isme kuch
din se 1-2 hafte tak lag sakte hain, ye Google ke control me hai,
humare nahi.

Jaldi karne ke liye:
  1. Favicon upload kijiye (kam se kam 512x512px, square image use
     karein — jitna bada utna better, background transparent ya
     solid rakhein).
  2. Google Search Console kholiye (search.google.com/search-console)
     apni site add/verify kijiye (agar already nahi ki hai).
  3. Wahan homepage URL daal ke "Request Indexing" click kijiye.
  4. Kuch din wait kijiye — phir Google search me "site:yourdomain.com"
     search karke check kar sakte ho.

Agar phir bhi favicon na dikhe to check kijiye:
  - Favicon URL directly browser me khulta hai ya nahi (broken/404
    nahi hona chahiye)
  - Image square hai (width = height)
  - Site robots.txt me favicon block nahi hai
