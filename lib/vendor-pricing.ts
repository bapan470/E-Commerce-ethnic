// ---------------------------------------------------------------------
// Vendor -> website price calculator.
//
// Mirrors the SAME markup structure Admin already uses on the
// Add/Edit Product form (components/admin/products-panel.tsx ->
// SettlementPreview / entry_markup_percent / mid_markup_percent /
// premium_markup_percent from Admin > Settings > Profit Estimate) —
// but built for the vendor side, where the number the vendor types in
// is NOT the price the customer pays.
//
// Why this exists: previously a vendor's "Expected Price" was saved
// straight into `price`/`final_price` with zero markup (see the old
// comment in app/api/vendor/products/route.ts) — the website showed
// exactly what the vendor typed. That meant the platform's shipping
// (BOTH legs — pickup from the vendor AND delivery to the customer)
// and commission were never actually recovered.
//
// The flow now:
//   1. Vendor types their own asking price (`vendor_expected_price`) —
//      this is treated as their COST price, same role `costPrice` plays
//      on the admin form.
//   2. We add BOTH shipping legs on top of it:
//        - vendor_pickup_shipping_cost   (vendor -> our warehouse)
//        - blended cod/prepaid logistics  (our warehouse -> customer)
//   3. We apply the same entry/mid/premium markup % admin already
//      configures in Settings, to that (vendor price + both shipping
//      legs) base — exactly like the "Suggested price" buttons on the
//      admin Add/Edit Product form.
//   4. The mid-range tier becomes the actual live `price` shown on the
//      website — deliberately different from what the vendor typed.
//
// Kept as a small, pure, framework-free module so it can be imported
// from both server route handlers (app/api/vendor/products/*) and
// client components (components/vendor/vendor-price-breakdown.tsx)
// without pulling in either's dependencies.
// ---------------------------------------------------------------------

import { ShippingSettings } from './pincode-api';

export interface VendorPriceBreakdown {
  /** What the vendor typed into "Your Price" — treated as their cost price. */
  vendorPrice: number;
  /** Leg 1: vendor's location -> our warehouse. */
  inboundShipping: number;
  /** Leg 2: our warehouse -> the customer (blended COD/prepaid, same math as admin's Safe Profit). */
  outboundShipping: number;
  /** inboundShipping + outboundShipping — shown to the vendor as "2 shipping charges added". */
  totalShipping: number;
  /** vendorPrice + totalShipping — the base the markup % is applied to. */
  costBasis: number;
  /** costBasis marked up by Settings > entry_markup_percent. */
  entryPrice: number;
  /** costBasis marked up by Settings > mid_markup_percent. */
  midPrice: number;
  /** costBasis marked up by Settings > premium_markup_percent. */
  premiumPrice: number;
  /**
   * The actual price shown to customers on the website — currently the
   * mid-range tier, rounded to the nearest rupee. This is what gets
   * saved into products.price / products.final_price, deliberately
   * different from `vendorPrice`.
   */
  websitePrice: number;
}

/**
 * Blended per-order courier cost for the warehouse -> customer leg,
 * across the COD/prepaid order mix from Settings. Identical formula to
 * blendedLogisticsCost() in components/admin/products-panel.tsx — kept
 * as a separate copy here (rather than importing that client component
 * into server route handlers) since this needs to run from plain API
 * routes too.
 */
function blendedOutboundShipping(settings: ShippingSettings): number {
  const codCost = settings.cod_logistics_cost || settings.flat_rate;
  const prepaidCost = settings.prepaid_logistics_cost || settings.flat_rate;
  const codShare = settings.cod_order_percent / 100;
  const prepaidShare = 1 - codShare;
  return Math.round((codCost * codShare + prepaidCost * prepaidShare) * 100) / 100;
}

/**
 * Turns a vendor's asking price into the full price breakdown,
 * including the real website price. Never throws — callers (both the
 * API routes and the live form preview) should be able to call this
 * with whatever numbers they have without extra guarding.
 */
export function computeVendorPriceBreakdown(
  vendorPrice: number,
  settings: ShippingSettings
): VendorPriceBreakdown {
  const safeVendorPrice = Number.isFinite(vendorPrice) && vendorPrice > 0 ? vendorPrice : 0;

  const inboundShipping = Math.max(0, settings.vendor_pickup_shipping_cost || 0);
  const outboundShipping = blendedOutboundShipping(settings);
  const totalShipping = Math.round((inboundShipping + outboundShipping) * 100) / 100;

  const costBasis = Math.round((safeVendorPrice + totalShipping) * 100) / 100;

  const markup = (percent: number) => Math.round(costBasis * (1 + (percent || 0) / 100));

  const entryPrice = markup(settings.entry_markup_percent);
  const midPrice = markup(settings.mid_markup_percent);
  const premiumPrice = markup(settings.premium_markup_percent);

  return {
    vendorPrice: safeVendorPrice,
    inboundShipping,
    outboundShipping,
    totalShipping,
    costBasis,
    entryPrice,
    midPrice,
    premiumPrice,
    websitePrice: midPrice,
  };
}
