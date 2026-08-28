'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { IndianRupee } from 'lucide-react';
import {
  fetchPriceRangeFilters,
  DEFAULT_PRICE_RANGE_FILTERS,
  PriceRangeBucket,
} from '@/lib/settings-api';

/**
 * "Shop by Price" quick-browse chips shown on the product detail page,
 * right below Add to Bag/Buy Now. Unlike the same-looking bar on /shop
 * (components/shop/price-range-filter-bar.tsx) this one isn't a live
 * in-page filter -- there's only one product on this page -- it's a
 * shortcut: tapping a chip takes the shopper to /shop already filtered to
 * that price band, so they can keep browsing at their budget. Buckets are
 * the same admin-managed list (Admin > Catalog > Price Filters).
 */
export default function PriceQuickBrowseBar() {
  const [ranges, setRanges] = useState<PriceRangeBucket[]>(DEFAULT_PRICE_RANGE_FILTERS);

  useEffect(() => {
    let cancelled = false;
    fetchPriceRangeFilters()
      .then((r) => {
        if (!cancelled) setRanges(r);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (ranges.length === 0) return null;

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-secondary">
        Shop by Price
      </p>
      <div className="flex gap-2.5 overflow-x-auto pb-2 pr-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ranges.map((bucket) => (
          <Link
            key={bucket.id}
            href={`/shop?pricebucket=${encodeURIComponent(bucket.id)}`}
            className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground/80 transition-colors hover:border-primary/60 hover:text-primary"
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-secondary">
              <IndianRupee className="h-2.5 w-2.5" />
            </span>
            {bucket.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
