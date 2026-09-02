Changed file: app/product/[slug]/product-detail.tsx

What changed:
- Product page ke title ke upar wali line (Category · ...) me ab "Source"
  aur "SKU number" bhi dikhta hai:
    Category · Vendor Name (ya "In-house" agar apna hi product hai) · SKU XXXX
- Agar product ek approved external vendor ka hai, uska public storefront
  naam clickable link ki tarah dikhta hai (jaisa pehle se collection ke
  liye tha). Apne in-house products ke liye "In-house" dikhega.
- SKU number bhi wahi se aata hai jo already Details accordion me tha
  (variant SKU pehle, warna product SKU) -- koi naya data source nahi.

Jaanbujh kar NAHI kiya:
- WhatsApp supplier ka naam/number (product_sources / product_sourcing
  tables) public product page pe NAHI daala. Ye tables migration
  20260910000000_hidden_product_sources.sql me deliberately RLS-locked
  hain -- sirf admin/service-role access kar sakta hai, taaki apke
  supplier ka number aur buy price kabhi customer, competitor, ya
  Google/bot ko na dikhe. Isko public karna is security design ko
  reverse karega aur apke supplier ki privacy + apka margin dono risk
  me daalega.

Apply karne ke steps:
1. Is zip ki file ko apne repo me same path pe replace karo:
   app/product/[slug]/product-detail.tsx
   (ya CHANGES.diff ko `git apply CHANGES.diff` se apply kar sakte ho)
2. `git add -A && git commit -m "Show vendor/source name + SKU on product page" && git push`
