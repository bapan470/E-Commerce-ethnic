Changed file: components/header.tsx

Kya badla:

1) Mobile menu drawer ab "Shop by Category" list ke baad seedha
   sirf "✦ FREE SHIPPING ABOVE ₹999 ✦" footer pe khatam hoti hai.
   Beech ka "More" section (Blog / About Us / My Account / Reseller /
   Contact Us) hata diya gaya hai — ye sab pages waise bhi header ke
   top icons (account/wishlist/cart) aur site footer se already
   accessible hain, sirf drawer ko clean/minimal banaya.

2) Har category ke saamne jo product count dikhta hai, ab usme
   color variations bhi count hoti hain — jaise agar "Cotton Blend"
   me 19 base products hain lekin unme se kuch ke 2-3 alag colours
   bhi hain, to ab count utni hi dikhegi jitni actually category
   page khol ke dekhne pe cards dikhte hain (pehle sirf base product
   count dikhta tha, colours count nahi hote the).

Apply kaise karein:
Apne project me components/header.tsx ko is file se replace kar dein.
