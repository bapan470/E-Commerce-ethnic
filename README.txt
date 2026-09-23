v12: WhatsApp payment link now shows a rich preview card (product photo from your own domain)

Files (same paths):
  components/admin/orders-panel.tsx               
  app/checkout/resume/[id]/page.tsx                (replace: adds link-preview metadata)
  app/api/og/pay/[id]/route.ts                     (NEW file: serves product photo as JPEG)

git add components/admin/orders-panel.tsx "app/checkout/resume/[id]/page.tsx" "app/api/og/pay/[id]/route.ts"
git commit -m "WhatsApp: payment link preview card with product photo from own domain"
git push

After deploy, test: open https://www.aruhihandlooms.com/api/og/pay/<any order id>  -> should show the product photo as an image.
