# GA4 + GTM + Google Ads Conversion Tracking Fix

## 3 files changed — copy into your project:

| File | Kya change hua |
|------|----------------|
| `app/layout.tsx` | GTM container script + Google Ads config support added |
| `app/product/[slug]/product-detail.tsx` | `add_to_cart` gtag event fire hota hai ab |
| `app/checkout/page.tsx` | `begin_checkout` + `purchase` gtag events fire hote hain |

## Step 1 — Files copy karo
Teen files apne project mein replace karo.

## Step 2 — Google Tag Manager setup (Recommended)

1. https://tagmanager.google.com pe jao
2. New account banao → Container type: Web
3. Container ID milega (GTM-XXXXXXX format)
4. Admin > Marketing > Analytics mein:
   - GTM Enabled: ON karo
   - GTM Container ID: GTM-XXXXXXX dalo

## Step 3 — GTM ke andar GA4 + Google Ads configure karo

### GA4 tag GTM mein:
- Tags > New → Google Analytics: GA4 Configuration
- Measurement ID: G-XXXXXXXX (apna GA4 ID)
- Trigger: All Pages

### Google Ads Conversion Tracking GTM mein:
- Tags > New → Google Ads Conversion Tracking
- Conversion ID: AW-8448343431
- Trigger: Custom Event → purchase

### Purchase Conversion tag:
- Tags > New → Google Ads Conversion Tracking  
- Conversion ID: AW-8448343431
- Conversion Label: (Google Ads se copy karo)
- Trigger: Custom Event → name: "purchase"

## Step 4 — Google Ads Goals fix karo

Dashboard mein jaake "Add to cart" aur "Begin checkout" ko **Primary** banao:
Goals > Conversions > pencil icon > Action optimization: Primary

## Step 5 — Test karo

1. Site pe jao → product cart mein daalo
2. GA4 DebugView kholo → `add_to_cart` event dikh raha hai?
3. Checkout page pe jao → `begin_checkout` dikh raha hai?
4. Test order place karo → `purchase` dikh raha hai?
