CHANGE: Product publish se auto social-share band, sirf Share button se share
===============================================================================

AAPNE KYA MANGA (samjha gaya)
-----------------------------
"Product publish karte hi auto Facebook/Instagram par share ho jaa raha he.
Ye auto-share nahi chahiye, sirf Share button pe click karunga tab hi
share hoga."

PEHLE KYA HO RAHA THA
----------------------
Codebase me ek "Social Auto-Post" feature already tha jo teen jagah se
FIRE-AND-FORGET tarike se Facebook / Instagram / Threads par auto-post kar
deta tha, product ke live hote hi:

  1. Vendor ka product AI se process hoke live hota -> auto post
     (app/api/vendor/ai-process/[id]/route.ts)
  2. Stuck listing ko safety-net cron job recover karke live karta -> auto post
     (lib/cron-jobs.ts -> runStuckVendorListingsJob)
  3. Admin khud "Add Product" karta -> auto post
     (components/admin/products-panel.tsx)

Ek MANUAL Share button bhi already tha (Admin > Manage Products > har row
ke Actions column me, Share2 icon) jo triggerSocialAutoPost() call karta
tha on-click. Lekin wo manual button ke SAATH-SAATH upar wale 3 automatic
triggers bhi chal rahe the — isliye product publish hote hi turant share
ho jaata tha, button dabaane se pehle hi.

KYA BADLA
---------
Upar wale teen automatic (fire-and-forget) triggers hata diye gaye hain.
Manual Share button — jo already Admin > Manage Products list me har
product row ke Actions column me hai — bilkul waisa hi kaam karega, koi
change nahi.

  1. app/api/vendor/ai-process/[id]/route.ts
     - "Auto-post to Facebook / Instagram" block hataya (publishProductToSocial
       call + uska unused import bhi hataya)

  2. lib/cron-jobs.ts (runStuckVendorListingsJob)
     - Recovered/stuck listing ko live karne ke baad ka auto social-post
       call hataya (+ unused import hataya)

  3. components/admin/products-panel.tsx
     - "Add Product" flow me product create hone ke turant baad ka
       triggerSocialAutoPost(created.id) fire-and-forget call hataya

RESULT
------
- Vendor submit kare ya Admin "Add Product" kare — product turant LIVE to
  hoga (isme koi change nahi), lekin Facebook/Instagram/Threads par KABHI
  bhi apne aap post nahi hoga.
- Share sirf tab hoga jab aap Admin > Manage Products list me us product
  ke Actions column me Share icon (chhota "share" wala button) pe click
  karenge. Click karte hi turant post hoga.
- Agar product pehle se share ho chuka hai to us row me green check-mark
  (✓) dikhega — usi icon pe dobara click karke, confirm karke re-share
  bhi kar sakte hain. Ye behavior pehle se hi tha, isme koi change nahi.
- Social Auto-Post settings (Admin > Marketing tab) me Facebook/Instagram/
  Threads on/off, Page ID, access token, caption template — ye sab waise
  hi rahega, kyunki Share button abhi bhi usi settings/config ko use karta
  hai jab aap manually click karte hain.

FILES CHANGED
-------------
  app/api/vendor/ai-process/[id]/route.ts
  lib/cron-jobs.ts
  components/admin/products-panel.tsx

Exact diff yahan hai: DISABLE-AUTO-SHARE.diff

KAISE APPLY KAREIN
-------------------
Option A (patch file se, fastest):
  1. Apne local clone me jaake ye command chalayein:
     git apply DISABLE-AUTO-SHARE.diff
  2. git add -A
  3. git commit -m "fix: remove auto social-share on publish, share only via button"
  4. git push

Option B (files copy karke):
  1. Is zip me di gayi teeno files ko apne repo me same path par copy
     karke overwrite kar dein:
       app/api/vendor/ai-process/[id]/route.ts
       lib/cron-jobs.ts
       components/admin/products-panel.tsx
  2. git add -A && git commit -m "fix: remove auto social-share on publish" && git push

Deploy hone ke baad turant test kar sakte hain: ek naya product add/submit
karein — wo live to hoga, lekin Facebook/Instagram par khud se post nahi
hoga jab tak aap us product ke row me Share button na dabayein.
