BUILD FIX — Cannot find name 'baseProduct'
============================================

Sirf 1 file change hui hai (pehle bheji gayi live-viewers-widget.zip mein
sirf yehi file galat thi, baaki 4 files sahi hain):

  app/product/[slug]/product-detail.tsx

Kya galat tha:
  LiveViewersBadge ko galat component (ProductInfo) ke andar daala tha,
  jahan `baseProduct` variable scope mein nahi tha.

Fix:
  <LiveViewersBadge productId={baseProduct?.id} />
  ko badal ke:
  <LiveViewersBadge productId={product.id} />
  kar diya — `product` prop wahi component ko already milta hai.

APPLY KAISE KAREIN
===================
1. Is file ko apne repo mein SAME PATH pe copy-paste karke replace karo:
     app/product/[slug]/product-detail.tsx

2. Terminal mein:
     git add "app/product/[slug]/product-detail.tsx"
     git commit -m "fix: live viewers badge scope error (build fix)"
     git push

3. Vercel apne aap redeploy karega — is baar build pass ho jana chahiye.

Verified: npm install + npx tsc --noEmit + npm run build sab clean pass
hue is fix ke saath (locally test kiya gaya).
