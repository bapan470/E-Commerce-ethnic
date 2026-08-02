'use client';

import { useEffect, useState } from 'react';
import { Truck, Wallet, TrendingUp } from 'lucide-react';
import { fetchShippingSettings, ShippingSettings, DEFAULT_SHIPPING_SETTINGS } from '@/lib/pincode-api';
import {
  HandlingFeeSettings,
  fetchHandlingFeeSettings,
} from '@/lib/settings-api';
import { computeVendorPriceBreakdown } from '@/lib/vendor-pricing';
import { formatINR } from '@/lib/format';

// Shown on the vendor Add/Edit Product form, right under "Your Price".
// Mirrors the admin's own "Estimated Settlement" calculator
// (components/admin/products-panel.tsx -> SettlementPreview) — same
// entry/mid/premium markup tiers from Admin > Settings > Profit
// Estimate — but built the other way round for a vendor: instead of
// showing what THEY keep after the price is fixed, it shows how their
// asking price turns INTO the actual website price.
//
// Deliberately makes explicit that "Your Price" and "Website Price"
// are two different numbers — that used to not be true (a vendor's
// price was saved straight into `price` with nothing added), which
// meant the platform never actually recovered shipping or commission.
export default function VendorPriceBreakdown({ vendorPrice }: { vendorPrice: number | null }) {
  const [settings, setSettings] = useState<ShippingSettings>(DEFAULT_SHIPPING_SETTINGS);
  const [fee, setFee] = useState<HandlingFeeSettings | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([fetchShippingSettings(), fetchHandlingFeeSettings()])
      .then(([s, f]) => {
        setSettings(s);
        setFee(f);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded || vendorPrice == null || !(vendorPrice > 0)) return null;

  const b = computeVendorPriceBreakdown(vendorPrice, settings);

  // What you'd net if the item sells at the final website price —
  // same commission formula as VendorPayoutPreview, just applied to
  // the real website price instead of your raw asking price.
  const commissionFee = fee
    ? Math.min(
        Math.round((fee.handling_fee_base + (b.websitePrice * fee.handling_fee_percent) / 100) * 100) / 100,
        b.websitePrice
      )
    : 0;
  const payable = fee ? Math.max(0, b.websitePrice - commissionFee) : null;

  return (
    <div className="mt-2 space-y-3 rounded-lg border border-border/60 bg-card p-4 text-sm">
      <div className="space-y-1 text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>Your price</span>
          <span className="font-medium text-foreground">{formatINR(b.vendorPrice)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Truck className="h-3 w-3" /> Pickup shipping (your location → our warehouse)
          </span>
          <span>+{formatINR(b.inboundShipping)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Truck className="h-3 w-3" /> Delivery shipping (warehouse → customer)
          </span>
          <span>+{formatINR(b.outboundShipping)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-border/60 pt-1 font-medium text-foreground">
          <span>Cost basis (your price + both shipping legs)</span>
          <span>{formatINR(b.costBasis)}</span>
        </div>
      </div>

      <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium">
          <TrendingUp className="h-3.5 w-3.5" />
          <span>Website Price (what customers actually see)</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
          <div className="rounded border border-border/60 bg-background px-2 py-1.5">
            <div className="text-muted-foreground">Entry +{settings.entry_markup_percent}%</div>
            <div className="font-semibold">{formatINR(b.entryPrice)}</div>
          </div>
          <div className="rounded border-2 border-primary bg-background px-2 py-1.5">
            <div className="text-primary">Mid-range +{settings.mid_markup_percent}%</div>
            <div className="font-serif text-base font-bold text-primary">{formatINR(b.midPrice)}</div>
          </div>
          <div className="rounded border border-border/60 bg-background px-2 py-1.5">
            <div className="text-muted-foreground">Premium +{settings.premium_markup_percent}%</div>
            <div className="font-semibold">{formatINR(b.premiumPrice)}</div>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Your product will be listed at <span className="font-semibold text-foreground">{formatINR(b.websitePrice)}</span> on
          the website — not the {formatINR(b.vendorPrice)} you entered. The difference covers pickup + delivery
          shipping and the platform markup.
        </p>
      </div>

      {payable !== null && fee && (
        <div className="flex items-start gap-1.5 rounded-md border border-emerald-200/70 bg-emerald-50/60 px-3 py-2 text-xs leading-snug text-emerald-700">
          <Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            You&apos;ll get <span className="font-semibold">{formatINR(payable)}</span> per piece once this sells and
            is delivered ({fee.handling_fee_percent}% commission
            {fee.handling_fee_base > 0 ? ` + ${formatINR(fee.handling_fee_base)} handling fee` : ''} on the website
            price). This is only an estimate — the final amount is locked in when the order is delivered.
          </span>
        </div>
      )}
    </div>
  );
}
