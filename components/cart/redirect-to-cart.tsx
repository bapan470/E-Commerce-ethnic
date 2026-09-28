'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Link-preview crawlers (WhatsApp etc.) don't run JS, so they read the OG
// tags of /cart-link/[id]; real visitors get sent on to the cart instantly.
export default function RedirectToCart() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/cart');
  }, [router]);
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
      Taking you to your cart…
    </div>
  );
}
