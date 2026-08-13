FIX: Duplicate GA4 / Google Ads "purchase" event

File changed: app/checkout/page.tsx

What changed:
- Removed the manual gtag('event','purchase', ...) calls that were firing
  directly inside app/checkout/page.tsx (both COD block and Online-payment
  block), right after an order was placed.
- Reason: components/analytics/purchase-tracker.tsx (<PurchaseTracker />)
  already fires this exact same GA4 purchase event on the
  /order-confirmation/[id] page, with proper sessionStorage dedupe.
  Checkout page was firing it a SECOND time before redirecting there,
  causing every order to be reported twice in GA4 DebugView and Google Ads
  (double transaction_id, double revenue).

How to apply:
1. Replace your local app/checkout/page.tsx with the one in this zip
   (same relative path: app/checkout/page.tsx).
2. git add app/checkout/page.tsx
3. git commit -m "fix: remove duplicate GA4/Google Ads purchase event fire in checkout"
4. git push

No other files were changed. components/analytics/purchase-tracker.tsx was
NOT modified — it's already correct and is now the single source of the
purchase event.
