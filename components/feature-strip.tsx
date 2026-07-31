'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { RotateCcw, Zap, Truck, type LucideIcon } from 'lucide-react';
import { fetchShippingSettings, DEFAULT_SHIPPING_SETTINGS } from '@/lib/pincode-api';

interface Feature {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}

/**
 * Trust strip shown site-wide right below the header — the three
 * reassurances a shopper looks for before trusting a new boutique with
 * their money: easy returns, how fast it ships, and the free-shipping
 * cutoff. The free-shipping line reads the real threshold from Admin >
 * Settings > Shipping, so it can never drift out of sync with checkout.
 */
export default function FeatureStrip() {
  const pathname = usePathname();
  const [threshold, setThreshold] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchShippingSettings()
      .then((s) => {
        if (!cancelled) setThreshold(s.free_shipping_threshold);
      })
      .catch(() => {
        if (!cancelled) setThreshold(DEFAULT_SHIPPING_SETTINGS.free_shipping_threshold);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (pathname?.startsWith('/admin')) return null;

  const shippingSubtitle =
    threshold === null
      ? '\u00A0' // reserve the line's height while loading so nothing jumps
      : threshold > 0
        ? `For orders ${threshold.toLocaleString('en-IN')}+`
        : 'On every order';

  const features: Feature[] = [
    { icon: RotateCcw, title: 'Easy returns', subtitle: 'Free pick up' },
    { icon: Zap, title: 'Fast delivery', subtitle: '10000+ styles' },
    { icon: Truck, title: 'Free shipping', subtitle: shippingSubtitle },
  ];

  return (
    <div className="border-b border-border/60 bg-card">
      <div className="container-boutique grid grid-cols-3 divide-x divide-border/60">
        {features.map((f) => (
          <div
            key={f.title}
            className="flex items-center justify-center gap-2 py-2.5 sm:gap-3 sm:py-3"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-primary ring-1 ring-secondary/30 sm:h-9 sm:w-9">
              <f.icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[11px] font-semibold text-foreground sm:text-sm">
                {f.title}
              </span>
              <span className="block truncate text-[9px] text-muted-foreground sm:text-xs">
                {f.subtitle}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
