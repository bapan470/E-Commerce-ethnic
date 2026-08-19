Is zip me 3 features hain (Hinglish) -- agar pehle wala patch already apply kar chuke ho to bas naya invoice-wala part relevant hoga, baaki same rahega (dobara apply karne me koi harm nahi, git apply khud bata dega agar already applied hai).

======================================================================
PART A: PIN code verification
======================================================================
- Checkout par PIN code real existence check hota hai (India Post se).
Files: lib/pincode-api.ts, app/checkout/page.tsx

======================================================================
PART B: Landmark field
======================================================================
- Checkout, invoice, Delhivery shipment, thank-you page, My Orders sab
  jagah landmark support.
Files: app/checkout/page.tsx, lib/delhivery-api.ts, lib/invoice-pdf.ts,
       app/order-confirmation/[id]/page.tsx, app/account/orders/[id]/page.tsx

======================================================================
PART C: Invoice button naming + Admin/Account me bhi add (NAYA)
======================================================================
1. "Download GST Invoice" ka naam badal ke "Download Invoice" kar diya
   (thank-you page + us page ka "GST Invoice available above" label bhi
   "Invoice available above" kar diya) -- app/order-confirmation/[id]/page.tsx

2. Account > My Orders (list page) -- ab har order card par "Download
   Invoice" button hai "View Order" ke bagal me, seedha list se hi
   invoice download ho sakta hai bina order khole.
   File: app/account/orders/page.tsx

3. Account > My Orders > (order detail page) -- top-right par order
   status ke neeche "Download Invoice" button add kiya.
   File: app/account/orders/[id]/page.tsx

4. Admin > Orders panel -- har order row ke "Actions" column me "View"
   button ke neeche ek chhota "Invoice" button add kiya, jisse admin
   bhi seedha wahi se invoice download kar sake, list ke andar row
   expand kiye bina.
   File: components/admin/orders-panel.tsx

NOTE: Invoice API (/api/invoice/[id]) pehle se hi bina kisi extra login
ke kaam karta hai (guest orders ka invoice bhi order-confirmation page
se already download hota tha) -- isliye admin panel aur account, dono
jagah button bina koi naya backend change kiye seedha kaam karega.

======================================================================
Apply kaise kare
======================================================================
Project folder me terminal khol ke:
    git apply CHANGES.patch
(Agar conflict aaye, to zip ke andar har file ko manually copy karke
apne project me SAME path par replace kar dena.)

Uske baad:
    git add -A
    git commit -m "Rename to Download Invoice, add invoice button in admin + account orders"
    git push

======================================================================
Test checklist
======================================================================
[ ] Thank-you page par button "Download Invoice" (GST wala naam nahi)
    dikhna chahiye.
[ ] Account > My Orders (list) -- har card par "Download Invoice"
    button dikhna aur kaam karna chahiye.
[ ] Account > My Orders > kisi order ko kholo -- top par "Download
    Invoice" button dikhna chahiye.
[ ] Admin > Orders -- kisi bhi order ke "Actions" column me "Invoice"
    button dikhna aur click karne par PDF download hona chahiye.
