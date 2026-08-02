'use client';

import { useEffect, useState } from 'react';
import { Truck, Wallet, TrendingUp, ShieldCheck, ShieldAlert } from 'lucide-react';
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
// Deliberately rendered full-width by the caller (not squeezed into a
// half-width form column) — the tiles and line items need real room,
// see app/vendor/dashboard/*/add-product/page.tsx and edit-product.
export default function VendorPriceBreakdown({ vendorPrice }: { vendorPrice: number | null }) {
  const [settings, setSettings] = useState<ShippingSettings>(DEFAULT_SHIPPING_SETTINGS);
  const [fee, setFee] = useState<HandlingFeeSettings | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Vendor's own real cost (fabric/stitching/sourcing) — never sent to
  // the server, purely a client-side "will I stay in profit if this
  // listing hits the 2x-return clawback threshold?" calculator. See
  // supabase/migrations/20260901000000_vendor_return_consent.sql for
  // how the clawback itself works (vendor_payable_amount of the 2nd/
  // threshold-hitting order is deducted from the next settlement).
  const [costPrice, setCostPrice] = useState('');

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
  // same commission formula as the old payout preview, just applied to
  // the real website price instead of your raw asking price.
  const commissionFee = fee
    ? Math.min(
        Math.round((fee.handling_fee_base + (b.websitePrice * fee.handling_fee_percent) / 100) * 100) / 100,
        b.websitePrice
      )
    : 0;
  const payable = fee ? Math.max(0, b.websitePrice - commissionFee) : null;

  // Profit-safety check: does this price survive the "2x return ->
  // sent back to vendor + clawback" flow? Clawback only ever removes
  // ONE payout (the order that trips the threshold), so with 2 sales:
  //   best case  = 1 kept payout - 1 unit's cost   (the returned unit
  //                comes back physically and can be resold later)
  //   worst case = 1 kept payout - 2 units' cost   (treat the returned
  //                unit as a total loss, e.g. damaged on return)
  const costNum = costPrice.trim() === '' ? null : Number(costPrice);
  const hasValidCost = costNum !== null && Number.isFinite(costNum) && costNum >= 0;
  const profitPerSale = hasValidCost && payable !== null ? payable - costNum! : null;
  const worstCaseAfter2Returns = hasValidCost && payable !== null ? payable - costNum! * 2 : null;

  const rows: { icon?: boolean; label: string; value: string; muted?: boolean }[] = [
    { label: 'Your price', value: formatINR(b.vendorPrice) },
    { icon: true, label: 'Pickup shipping — your location → our warehouse', value: `+${formatINR(b.inboundShipping)}`, muted: true },
    { icon: true, label: 'Delivery shipping — warehouse → customer', value: `+${formatINR(b.outboundShipping)}`, muted: true },
  ];

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5">
      <h3 className="mb-3 text-sm font-semibold text-foreground">How your price becomes the website price</h3>

      <div className="space-y-2.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-4 text-sm">
            <span className={`flex items-start gap-1.5 ${row.muted ? 'text-muted-foreground' : 'text-foreground'}`}>
              {row.icon && <Truck className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
              {row.label}
            </span>
            <span className={`shrink-0 whitespace-nowrap font-medium ${row.muted ? 'text-muted-foreground' : 'text-foreground'}`}>
              {row.value}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-4 border-t border-border/60 pt-2.5 text-sm font-semibold text-foreground">
          <span>Cost basis (price + both shipping legs)</span>
          <span className="shrink-0 whitespace-nowrap">{formatINR(b.costBasis)}</span>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
        <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span>Website Price — what customers actually see</span>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-border/60 bg-background px-3 py-2.5 text-center">
            <div className="text-[11px] text-muted-foreground">Entry +{settings.entry_markup_percent}%</div>
            <div className="mt-0.5 font-serif text-base font-semibold text-foreground">{formatINR(b.entryPrice)}</div>
          </div>
          <div className="rounded-lg border-2 border-primary bg-background px-3 py-2.5 text-center">
            <div className="text-[11px] font-medium text-primary">Mid-range +{settings.mid_markup_percent}%</div>
            <div className="mt-0.5 font-serif text-lg font-bold text-primary">{formatINR(b.midPrice)}</div>
          </div>
          <div className="rounded-lg border border-border/60 bg-background px-3 py-2.5 text-center">
            <div className="text-[11px] text-muted-foreground">Premium +{settings.premium_markup_percent}%</div>
            <div className="mt-0.5 font-serif text-base font-semibold text-foreground">{formatINR(b.premiumPrice)}</div>
          </div>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Your product will be listed at{' '}
          <span className="font-semibold text-foreground">{formatINR(b.websitePrice)}</span> on the website — not
          the {formatINR(b.vendorPrice)} you entered. The difference covers pickup + delivery shipping and the
          platform markup.
        </p>
      </div>

      {payable !== null && fee && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200/70 bg-emerald-50/60 px-3.5 py-3 text-xs leading-relaxed text-emerald-700">
          <Wallet className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            You&apos;ll get <span className="font-semibold">{formatINR(payable)}</span> per piece once this sells
            and is delivered ({fee.handling_fee_percent}% commission
            {fee.handling_fee_base > 0 ? ` + ${formatINR(fee.handling_fee_base)} handling fee` : ''} on the website
            price). This is only an estimate — the final amount is locked in when the order is delivered.
          </span>
        </div>
      )}

      <div className="mt-3 rounded-lg border border-border/60 bg-muted/30 p-4">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span>Profit safety check — will this survive a 2x return?</span>
        </div>
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
          If this exact listing gets returned twice, the payout for the 2nd (threshold-hitting) order is clawed
          back from your next settlement and the item is sent back to you. Enter your real cost per piece (fabric
          + stitching + sourcing) to see if your current price still leaves you in profit.
        </p>

        <label className="mb-1 block text-xs font-medium text-foreground" htmlFor="vendor-cost-price">
          Your actual cost per piece (optional)
        </label>
        <input
          id="vendor-cost-price"
          type="number"
          min={0}
          inputMode="decimal"
          placeholder="e.g. 350"
          value={costPrice}
          onChange={(e) => setCostPrice(e.target.value)}
          className="mb-3 w-full max-w-[180px] rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
        />

        {hasValidCost && payable !== null && profitPerSale !== null && worstCaseAfter2Returns !== null ? (
          <div
            className={`flex items-start gap-2 rounded-md px-3 py-2.5 text-xs leading-relaxed ${
              profitPerSale > 0
                ? 'border border-emerald-200/70 bg-emerald-50/60 text-emerald-700'
                : 'border border-red-200/70 bg-red-50/60 text-red-700'
            }`}
          >
            {profitPerSale > 0 ? (
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>
              Profit per normal sale: <span className="font-semibold">{formatINR(profitPerSale)}</span>
              {' '}(payout {formatINR(payable)} − cost {formatINR(costNum!)}).
              {profitPerSale > 0 ? (
                <>
                  {' '}Since a single kept sale already clears your cost, a 2x-return clawback on this listing
                  won&apos;t push you into an overall loss — you&apos;ll just lose the &quot;extra&quot; payout
                  from the returned unit, and get that unit back to resell.
                </>
              ) : (
                <>
                  {' '}Your price doesn&apos;t even cover your own cost on a normal sale — raise &quot;Your
                  Price&quot; before listing, or every return (let alone 2 returns) will put you in a loss.
                </>
              )}
              {' '}Worst case if the returned unit is unsellable too: {formatINR(worstCaseAfter2Returns)}.
            </span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Enter your cost above to see the safety check.</p>
        )}
      </div>
    </div>
  );
}
