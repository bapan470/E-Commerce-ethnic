'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { GCR_MERCHANT_ID } from '@/lib/google-customer-reviews';

// Pages that should never show the badge (back-office + payment flow).
const HIDDEN_PREFIXES = ['/admin', '/vendor', '/checkout'];

/**
 * Google Customer Reviews badge -- the small floating Google badge that shows
 * the store rating. Mounted once in app/layout.tsx.
 *
 * Until Google has enough reviews to compute a store rating (roughly 100+ per
 * country), the badge says "Rating not available". To switch it off without a
 * code change, set NEXT_PUBLIC_GCR_BADGE=off in the environment and redeploy.
 *
 * BOTTOM_LEFT: the WhatsApp / live-chat buttons already sit bottom-right.
 */
export default function GoogleCustomerReviewsBadge() {
  const pathname = usePathname() || '';
  if (process.env.NEXT_PUBLIC_GCR_BADGE === 'off') return null;
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  return (
    <Script
      id="merchantWidgetScript"
      src="https://www.gstatic.com/shopping/merchant/merchantwidget.js"
      strategy="lazyOnload"
      onLoad={() => {
        const w = window as any;
        if (w.__gcrBadgeStarted || !w.merchantwidget?.start) return;
        w.__gcrBadgeStarted = true; // start() once per page load
        w.merchantwidget.start({
          merchant_id: GCR_MERCHANT_ID,
          position: 'BOTTOM_LEFT',
          region: 'IN',
        });
      }}
    />
  );
}
