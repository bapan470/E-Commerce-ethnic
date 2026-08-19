Fact-check result (jo maine confirm kiya):
- Vendor ko pehle koi invoice/document option NAHI tha.
- Aapke code me already ek jaan-boojh kar bana hua safeguard hai:
  vendor ko customer ka naam/email/phone/address DATABASE QUERY LEVEL
  par hi diya hi nahi jata (sirf UI se chhupaya nahi jata -- query khud
  us data ko fetch hi nahi karti). Ye
  app/api/vendor/orders/route.ts me comment ke saath likha hua hai.

Isliye maine vendor ke liye "Invoice" NAHI, balki ek "PICKUP SLIP" banaya
hai -- jisme:
  - "Ship To" = AAPKA warehouse address (Admin > Settings > Delhivery
    pickup location se aata hai)
  - Product naam, barcode, quantity, price, order reference
  - Customer ka NAAM, PHONE, EMAIL, ADDRESS -- KUCH BHI NAHI

======================================================================
Naye/changed files
======================================================================

1. lib/vendor-pickup-slip-pdf.ts (NAYA)
   - PDF generator -- "VENDOR PICKUP SLIP" title, "From (Vendor)" aur
     "Ship To (Our Warehouse)" do column layout, item table (product,
     barcode, qty, price), footer note "contains no customer
     information".

2. app/api/vendor/orders/[itemId]/pickup-slip/route.ts (NAYA)
   - Vendor login check karta hai, phir sirf order_items table se
     (explicit column list, kabhi bhi orders table join nahi karta jahan
     customer data hota hai) us item ko fetch karta hai jo USI vendor ka
     hai (vendor_id match), phir warehouse address (Delhivery settings)
     + store name ke saath PDF banata hai.
   - Agar item kisi aur vendor ka hai ya exist nahi karta, 404 deta hai
     (403 nahi -- taaki kisi ko pata na chale ki item exist karta hai ya
     nahi, ye ek security best-practice hai).

3. app/vendor/dashboard/orders/page.tsx
   - Har order item card me, "Ship to: <warehouse>" line ke neeche ek
     naya button: "Download Pickup Slip".

======================================================================
Baaki files (pichle patches -- agar already apply nahi kiya to isi zip
me hai)
======================================================================
- Landmark field (checkout/invoice/delivery)
- PIN code verification
- "Download Invoice" rename + Admin/Account me invoice button
(In sab me koi conflict nahi hoga agar already apply ho chuka hai --
git apply khud bata dega.)

======================================================================
Apply kaise kare
======================================================================
Project folder me terminal khol ke:
    git apply CHANGES.patch
(Agar naye files ka conflict aaye -- unlikely, kyunki ye bilkul naye
files hain -- to zip ke andar se manually copy kar dena:
   lib/vendor-pickup-slip-pdf.ts
   app/api/vendor/orders/[itemId]/pickup-slip/route.ts
apne project me EXACT SAME path par.)

Uske baad:
    git add -A
    git commit -m "Add vendor pickup slip (warehouse address, no customer data)"
    git push

======================================================================
Test checklist
======================================================================
[ ] Ek vendor account se login karo -> Vendor Dashboard > Orders khol.
[ ] Kisi bhi order item card par "Download Pickup Slip" button click
    karo -> PDF download hona chahiye.
[ ] PDF khol ke check karo:
      - "Ship To" me AAPKA warehouse address hona chahiye (jo Admin >
        Settings > Delhivery me set hai), customer ka address NAHI.
      - Customer ka naam/phone/email KAHI bhi nahi hona chahiye.
      - Product naam, barcode, quantity, price sahi dikhne chahiye.
[ ] Ek doosre vendor account se, pehle vendor ke item ka pickup-slip URL
    directly try karo (agar URL guess kar sako) -> "Item not found"
    error aana chahiye, PDF nahi milna chahiye.
