'use client';

import { useMemo } from 'react';
import { Product } from '@/lib/types';
import ProductCard from '@/components/product-card';

/**
 * Scores every candidate against the current product and returns the best
 * matches: same category counts most, shared fabric and shared occasion
 * tags add extra weight, and in-stock items are preferred over out-of-stock
 * ones so "You may also like" doesn't dead-end the shopper.
 */
function scoreCandidate(current: Product, candidate: Product): number {
  let score = 0;
  if (candidate.category === current.category) score += 3;
  if (candidate.fabric && candidate.fabric === current.fabric) score += 2;
  const sharedOccasions = (candidate.occasion || []).filter((o) =>
    (current.occasion || []).includes(o)
  ).length;
  score += sharedOccasions;
  if (candidate.inStock) score += 1;
  return score;
}

export default function RelatedProducts({
  current,
  allProducts,
  limit = 4,
  title = 'You may also like',
}: {
  current: Product;
  allProducts: Product[];
  limit?: number;
  title?: string;
}) {
  const related = useMemo(() => {
    return allProducts
      .filter((p) => p.id !== current.id)
      .map((p) => ({ product: p, score: scoreCandidate(current, p) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || b.product.rating - a.product.rating)
      .slice(0, limit)
      .map((entry) => entry.product);
  }, [current, allProducts, limit]);

  if (related.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-5 font-serif text-2xl font-bold text-primary">{title}</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {related.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
