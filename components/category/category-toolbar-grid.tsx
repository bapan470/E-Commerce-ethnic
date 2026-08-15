'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { SlidersHorizontal } from 'lucide-react';
import { Product } from '@/lib/types';
import ProductCard from '@/components/product-card';
import QuickNavIcons from '@/components/quick-nav-icons';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'rating' | 'newest';

interface CategoryToolbarGridProps {
  products: Product[];
  /** Category NAME (not slug) — /shop's `?category=` filter matches on
   *  the product's category name, same as every other link into it
   *  (footer, product-card "view all in category", related products). */
  categoryName: string;
}

/**
 * Renders the same Filters/Sort bar shoppers already know from /shop —
 * plus the Home/Categories quick-nav icons — on top of a category page's
 * product grid, so browsing a single category isn't a dead-end missing
 * the sort control every other listing page has. This page doesn't carry
 * the full price/size/colour/fabric filter panel /shop has (that state
 * lives entirely client-side in shop-content.tsx); "Filters" here hands
 * off to /shop pre-filtered to this category instead of duplicating that
 * whole panel for a single-category view.
 */
export default function CategoryToolbarGrid({ products, categoryName }: CategoryToolbarGridProps) {
  const [sort, setSort] = useState<SortKey>('featured');

  const sorted = useMemo(() => {
    const list = [...products];
    switch (sort) {
      case 'price-asc':
        list.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        list.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        list.sort((a, b) => b.rating - a.rating);
        break;
      case 'newest':
        list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
        break;
      default:
        list.sort((a, b) => Number(!!b.featured) - Number(!!a.featured));
    }
    return list;
  }, [products, sort]);

  return (
    <>
      <div
        className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-border bg-background/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur-sm md:static md:mb-5 md:mt-8 md:border-0 md:bg-transparent md:px-0 md:py-0 md:shadow-none md:backdrop-blur-none"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center gap-2">
          <QuickNavIcons />
          <Button variant="outline" className="lg:hidden" asChild>
            <Link href={`/shop?category=${encodeURIComponent(categoryName)}`}>
              <SlidersHorizontal className="mr-2 h-4 w-4" /> Filters
            </Link>
          </Button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Label className="hidden text-sm text-muted-foreground sm:inline">Sort by</Label>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="featured">Featured</SelectItem>
              <SelectItem value="price-asc">Price: Low to High</SelectItem>
              <SelectItem value="price-desc">Price: High to Low</SelectItem>
              <SelectItem value="rating">Top Rated</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {sorted.map((p, i) => (
          <ProductCard key={p.id} product={p} priority={i < 4} />
        ))}
      </div>
    </>
  );
}
