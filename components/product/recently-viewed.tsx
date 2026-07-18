'use client';

import { useEffect, useState } from 'react';
import { useProducts } from '@/lib/cart-context';
import { getRecentlyViewed } from '@/lib/recently-viewed';
import { Product } from '@/lib/types';
import ProductCard from '@/components/product-card';

export default function RecentlyViewedSection({ excludeId }: { excludeId?: string }) {
  const { products } = useProducts();
  const [ids, setIds] = useState<string[]>([]);

  // Read localStorage only on the client, after mount, to avoid SSR mismatch.
  useEffect(() => {
    setIds(getRecentlyViewed(excludeId));
  }, [excludeId]);

  if (ids.length === 0 || products.length === 0) return null;

  const byId = new Map(products.map((p) => [p.id, p]));
  const items = ids
    .map((id) => byId.get(id))
    .filter((p): p is Product => Boolean(p))
    .slice(0, 8);

  if (items.length === 0) return null;

  return (
    <section className="mt-14">
      <h2 className="mb-5 font-serif text-2xl font-bold text-primary">Recently Viewed</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
