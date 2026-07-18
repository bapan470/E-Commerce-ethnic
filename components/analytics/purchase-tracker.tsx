'use client';

import { useEffect } from 'react';

interface PurchaseTrackerItem {
  product_id: string | null;
  product_name: string;
  price: number;
  quantity: number;
}

interface PurchaseTrackerProps {
  orderId: string;
  value: number;
  shipping?: number;
  tax?: number;
  couponCode?: string | null;
  items: PurchaseTrackerItem[];
}

/**
 * Fires the GA4 ecommerce "purchase" event once the order-confirmation
 * page loads. Renders nothing — it's a side-effect-only component.
 *
 * Guarded with sessionStorage so refreshing this page (or the user
 * coming back to it later) never reports the same order twice.
 */
export default function PurchaseTracker({
  orderId,
  value,
  shipping,
  tax,
  couponCode,
  items,
}: PurchaseTrackerProps) {
  useEffect(() => {
    const dedupeKey = `ga4_purchase_${orderId}`;
    try {
      if (sessionStorage.getItem(dedupeKey)) return;
      sessionStorage.setItem(dedupeKey, '1');
    } catch {
      // sessionStorage unavailable (e.g. private mode) — fall through and track anyway.
    }

    const gtag = (window as any).gtag;
    if (typeof gtag !== 'function') return;

    gtag('event', 'purchase', {
      transaction_id: orderId,
      value,
      currency: 'INR',
      shipping: shipping ?? 0,
      tax: tax ?? 0,
      coupon: couponCode ?? undefined,
      items: items.map((item) => ({
        item_id: item.product_id ?? item.product_name,
        item_name: item.product_name,
        price: item.price,
        quantity: item.quantity,
      })),
    });
  }, [orderId, value, shipping, tax, couponCode, items]);

  return null;
}
