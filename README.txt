IMPRESSIONS-FIRST SHOP SORT
============================
Yeh zip sirf 2 files replace karta hai (same path structure hai, seedha
project root me paste kar do, overwrite confirm kar dena):

  lib/popularity-rank-server.ts
  app/api/products/popularity/route.ts

Kya change hua:
Shop page (aur category pages) ka default "Popularity" sort ab sabse
pehle Impressions (product_view) dekh kar order karta hai — jis product
ka impression sabse zyada hai, wo sabse upar dikhega.

Agar impressions barabar hon do products ke beech, tab tie-break ke liye
Purchase > Begin checkout > Add to cart dekha jayega (isi order me).

Pehle yeh order Purchase-first tha (purchase sabse important, impression
sirf last tie-breaker), ab Impression-first kar diya gaya hai jaisa
tumne bola.

changes.diff file me exact diff bhi hai reference ke liye — git apply
bhi kar sakte ho agar chaho:
  git apply changes.diff
