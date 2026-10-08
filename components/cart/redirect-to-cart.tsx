'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { queuePendingCoupon } from '@/lib/cart-context';

// Link-preview crawlers (WhatsApp etc.) don't run JS, so they read the OG
// tags of /cart-link/[id]; real visitors get sent on to the cart instantly.
// If the link carries ?coupon=CODE (abandoned-cart WhatsApp message), the code is
// queued here and CartProvider auto-applies it once the cart has loaded.
export default function RedirectToCart() {
  const router = useRouter();
  useEffect(() => {
    try {
      const code = new URLSearchParams(window.location.search).get('coupon');
      if (code) queuePendingCoupon(code);
    } catch {
      // ignore
    }
    router.replace('/cart');
  }, [router]);
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
      Taking you to your cart…
    </div>
  );
}
