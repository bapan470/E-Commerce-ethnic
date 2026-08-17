Kya naya add/change hua (Hinglish):

1. Cancellation window ab 24 hours (1 day) hai (default).
   - lib/marketing-api.ts me DEFAULT_FULFILLMENT_SETTINGS.cancellation_window_hours
     12 se 24 kar diya.
   - NOTE: Agar aapne pehle se hi Admin > Marketing > Shipping & Returns
     Timing me koi value save kar rakhi hai (DB me row already exists),
     to ye default value use hi nahi hogi -- wahan jaake manually 24 kar
     dena.

2. Ship hone ke baad order KABHI bhi cancel nahi hoga -- chahe same din
   hi ship kyun na hua ho, time window bacha ho ya nahi.
   - app/api/orders/[id]/cancel/route.ts me ek naya check add kiya:
     agar order.tracking_number set hai (matlab shipment ban chuka hai),
     to seedha "This order has already shipped..." error aayega, time
     window check hone se pehle hi.
   - (Pehle bhi status='shipped' hone par cancel button nahi dikhta tha,
     ye extra safety check hai taaki edge-case me bhi na ho paye.)

3. Naya component: components/order/cancel-or-help.tsx
   - Ye decide karta hai: agar order abhi cancel-eligible hai (window ke
     andar hai AND ship nahi hua), to "Cancel Order" button dikhega.
   - Agar cancel eligible NAHI hai (window nikal gaya YA already ship ho
     chuka hai) lekin order abhi bhi "in-flight" hai (delivered/cancelled/
     failed nahi hua), to ek chota box dikhega:
        "This order has already shipped, so it can no longer be
        cancelled online. Please contact us for help."
     ya
        "The 24-hour cancellation window for this order has passed.
        Please contact us for help."
     ...saath me ek "Contact Us" link, jo /contact page par le jayega,
     jahan Subject aur Message pehle se bhare hue honge (order number ke
     saath), customer ko sirf apna naam/email/phone bharna hoga.
   - Ye component ab 2 jagah use ho raha hai:
       - Thank-you page (app/order-confirmation/[id]/page.tsx)
       - Account > My Orders > order detail page
         (app/account/orders/[id]/page.tsx)

4. app/contact/page.tsx aur components/contact-form.tsx
   - Contact form ab URL query params (?subject=...&message=...) se
     pre-fill ho sakta hai, jo upar wala "Contact Us" link use karta hai.

Baaki (pichle patches wale) changes bhi isi zip me hain:
   - Har order status change par customer ko email (lib/orders-api.ts,
     lib/email-templates.ts)
   - Guest checkout ke orders bhi bina login cancel ho sakte hain
     (app/api/orders/[id]/cancel/route.ts)
   - Thank-you page par status badge + fresh (non-cached) data
     (app/order-confirmation/[id]/page.tsx)
   - Order confirmation email me "View / Cancel Order" button
     (lib/email-templates.ts)

Apply kaise kare:
  Project folder me terminal khol ke:
    git apply CHANGES.patch
  (Agar conflict aaye, to zip ke andar har file ko manually copy karke
  apne project me SAME path par replace kar dena -- naya file
  components/order/cancel-or-help.tsx bhi is zip me hai, use naye path
  par create kar dena agar patch fail ho.)

Uske baad:
    git add -A
    git commit -m "24h cancel window, block cancel after ship, Contact Us fallback"
    git push

Test checklist:
  [ ] Naya order place karo -> thank-you page par "Cancel Order" dikhna
      chahiye (agar 24 ghante ke andar hai).
  [ ] Admin se us order ko "shipped" kar do (ya tracking number daal do)
      -> thank-you page refresh karo -> ab Cancel button ki jagah
      "already shipped... Contact Us" wala box dikhna chahiye.
  [ ] Us "Contact Us" link par click karo -> /contact page khulna
      chahiye, Subject/Message already order number ke saath bhara hua.
  [ ] Admin Settings me cancellation window 24 confirm/set kar lena.
