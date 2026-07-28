FAVICON UPLOAD FEATURE — INSTRUCTIONS (Hinglish)
==================================================

Kya change hua:
----------------
Sirf 1 file change hui hai:
  components/admin/marketing-panel.tsx

Admin panel me: Marketing > SEO tab me pehle sirf ek plain text "Favicon URL"
input tha jaha aapko khud CDN se URL paste karna padta tha.

Ab wahan:
  - "Upload favicon image" button hai — seedha apne computer se image
    choose karke upload kar sakte ho (PNG/JPG/WEBP/SVG/ICO).
  - Upload hote hi image Supabase Storage ke 'product-images' bucket
    me save hoti hai aur favicon_url apne aap set + save ho jata hai.
  - Preview thumbnail aur "Remove favicon" button bhi milega.
  - Neeche ek chhota text input bhi hai agar aap manually URL paste
    karna chaho (fallback / advanced use).

Baaki poora system (favicon actually site pe kaise dikhta hai — via
app/icon.tsx jo seo_settings.favicon_url read karta hai) already
maujood tha, maine sirf upload UI add ki hai.

Kaise apply karein:
--------------------
1) Is zip me se "components/admin/marketing-panel.tsx" file ko
   apne repo ke usi path par REPLACE kar dijiye:
     components/admin/marketing-panel.tsx

2) Phir apne terminal me:
     git add components/admin/marketing-panel.tsx
     git commit -m "Add favicon upload UI in Admin > Marketing > SEO"
     git push

(Agar chahein to attached "changes.patch" file bhi use kar sakte ho:
     git apply changes.patch
 lekin seedha file replace karna sabse simple tarika hai.)

Test karne ka tarika:
----------------------
- npm run dev karke Admin > Marketing > SEO tab kholiye.
- "Upload favicon image" par click karke koi square image (e.g. 512x512
  PNG logo) choose kijiye.
- Upload complete hote hi preview dikhega aur toast "Favicon uploaded"
  aayega. Browser tab refresh karne par naya favicon dikhna chahiye
  (kabhi kabhi favicon dikhne me thoda cache time lagta hai).
