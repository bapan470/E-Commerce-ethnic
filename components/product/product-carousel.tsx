'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Product } from '@/lib/types';
import ProductCard from '@/components/product-card';

export default function ProductCarousel({
  title,
  products,
  viewAllHref,
}: {
  title: string;
  products: Product[];
  /** Shown as a "View All" link in the section header when provided. */
  viewAllHref?: string;
}) {
  if (products.length === 0) return null;

  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center justify-between">
        {viewAllHref ? (
          <Link
            href={viewAllHref}
            className="font-serif text-xl font-bold text-primary transition-colors hover:text-secondary sm:text-2xl"
          >
            {title}
          </Link>
        ) : (
          <h2 className="font-serif text-xl font-bold text-primary sm:text-2xl">{title}</h2>
        )}
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-secondary transition-colors hover:text-primary sm:text-sm"
          >
            View All
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {/* Horizontally scrollable strip — same site padding as everywhere
          else (no edge-to-edge bleed), just tighter card size/gap so more
          items peek into view and invite a swipe, like the reference. */}
      <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar snap-x snap-mandatory">
        {products.map((p, idx) => (
          <div
            key={p.id}
            className="w-[42%] shrink-0 snap-start sm:w-[180px] md:w-[200px]"
          >
            <ProductCard product={p} compact priority={idx < 2} />
          </div>
        ))}
      </div>
    </section>
  );
}
