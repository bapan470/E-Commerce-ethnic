Changed file: app/shop/shop-content.tsx

Kya add kiya:
- /shop page ke top pe ek horizontally-scrollable circular category strip
  add ki gayi (screenshot jaisa) — har category ka thumbnail (us category
  ke pehle product ki photo) + niche naam.
- Tap karne pe wahi category /shop page pe hi filter ho jati hai
  (?category=... param), current selected category ka circle maroon
  border se highlight hota hai. Dubara tap karne se filter clear ho
  jata hai.
- Text search (/search) page par yeh strip nahi dikhti, sirf plain
  /shop browsing par.
- Sirf un categories ke circles dikhte hain jinme kam se kam 1 product
  hai (khaali category kabhi nahi dikhegi).

Apply kaise karein:
Apne project me app/shop/shop-content.tsx ko is file se replace kar dein.
