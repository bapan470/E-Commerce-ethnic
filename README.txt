Is zip me 2 features hain (Hinglish):

======================================================================
PART A: PIN code verification (pehle deliver kiya tha, agar apply nahi
kiya to isi zip me bhi hai)
======================================================================
- Checkout par PIN code ab sirf "format" nahi, REAL existence bhi check
  hoga (India Post ke database se) -- fake pincode par order place nahi
  hoga.
- Field ke neeche live status: "Checking...", green "Verified: City,
  State", ya red "This PIN code doesn't exist".
Files: lib/pincode-api.ts, app/checkout/page.tsx

======================================================================
PART B: Landmark field (NAYA)
======================================================================
1. app/checkout/page.tsx
   - "Apartment, suite, etc." field ke neeche ek naya optional
     "Landmark" field add kiya (e.g. "Near City Hospital").
   - Order summary preview me turant dikhता है.
   - Guest checkout aur login wale dono ke liye kaam karta hai.
   - Saved address select karne par landmark clear ho jata hai (saved
     addresses me landmark save nahi hota abhi -- customer chahe to
     manually daal sakta hai us waqt).

2. lib/delhivery-api.ts
   - Jab admin "Create Shipment" karega, landmark automatically
     Delhivery ko bheje jaane wale consignee address me add ho jayega:
     "<address>, <address2>, Landmark: <landmark>"
   - Isse Delhivery ka delivery agent address dhoondhne me landmark
     bhi dekh payega.
   - Return pickup (reverse shipment) ke address me bhi same tarike se
     landmark include hota hai.

3. lib/invoice-pdf.ts
   - GST Invoice PDF ke "Billed & Shipped To" section me ab ek alag
     line me "Landmark: <landmark>" dikhega (agar customer ne diya ho).

4. app/order-confirmation/[id]/page.tsx (Thank-you page)
   aur app/account/orders/[id]/page.tsx (My Orders detail page)
   - Dono jagah shipping address ke saath "(Near <landmark>)" bhi
     dikhega.

NOTE: Ye landmark field OPTIONAL hai -- agar customer khali chhod de,
kahin bhi kuch extra nahi dikhega, sab kuch pehle jaisa hi chalega.

======================================================================
Apply kaise kare
======================================================================
Project folder me terminal khol ke:
    git apply CHANGES.patch
(Agar conflict aaye, to zip ke andar har file ko manually copy karke
apne project me SAME path par replace kar dena.)

Uske baad:
    git add -A
    git commit -m "Add landmark field to checkout, invoice, delivery + PIN code verification"
    git push

======================================================================
Test checklist
======================================================================
[ ] Checkout par ek real pincode daalo -> green "Verified" message +
    City/State auto-fill.
[ ] Ek fake/non-existent pincode daalo -> red error, "Place Order"
    click karne par order place NAHI hona chahiye.
[ ] Checkout par "Landmark" field me kuch likho (e.g. "Near City
    Hospital"), order place karo.
[ ] Thank-you page + My Orders detail page -> address ke saath
    "(Near City Hospital)" dikhna chahiye.
[ ] Admin -> us order ka "Download GST Invoice" khol ke check karo ->
    "Landmark: City Hospital" line dikhni chahiye.
[ ] Admin se us order ka "Create Shipment" karo -> Delhivery ko
    bheja gaya address (chahe to Delhivery dashboard me consignment
    dekh ke verify kar sakte ho) me landmark bhi shamil hona chahiye.
