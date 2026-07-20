'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight, ImageOff } from 'lucide-react';
import { useMemo } from 'react';
import { useProducts } from '@/lib/cart-context';
import { Skeleton } from '@/components/ui/skeleton';
import { blurDataURL } from '@/lib/utils';

// Alternating soft tints (built from the site's own primary/secondary
// theme tokens, not hardcoded hex) so each row reads as a distinct card
// the way the reference layout does, without introducing a new palette.
const TINTS = [
  'bg-primary/10',
  'bg-secondary/15',
  'bg-primary/5',
  'bg-secondary/10',
];

export default function CategoriesPage() {
  const { products, categories, loading } = useProducts();

  // Fully dynamic: every row is derived from whatever categories exist in
  // Supabase right now, and the circular thumbnails are pulled live from
  // whichever products currently belong to that category. Add a category
  // in admin → a new row appears here automatically. Delete one → it's
  // gone. Add/remove/replace product photos → the circles update with them,
  // no code change needed anywhere.
  const rows = useMemo(() => {
    return categories.map((c) => {
      const inCat = products.filter((p) => p.category === c.name);
      const thumbs = inCat
        .slice()
        .sort((a, b) => Number(!!b.featured) - Number(!!a.featured))
        .slice(0, 3)
        .map((p) => p.images[0])
        .filter(Boolean) as string[];
      return { ...c, count: inCat.length, thumbs };
    });
  }, [categories, products]);

  return (
    <div className="container-boutique py-8 pb-24 md:pb-12">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
          Explore
        </p>
        <h1 className="mt-1 font-serif text-3xl font-bold text-primary sm:text-4xl">
          Shop by Category
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {loading
            ? 'Loading…'
            : `${categories.length} ${categories.length === 1 ? 'category' : 'categories'}`}
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-20 text-center">
          <p className="font-serif text-lg font-semibold">No categories yet</p>
          <p className="text-sm text-muted-foreground">
            Categories added from the admin panel will show up here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((c, i) => (
            <Link
              key={c.id}
              href={`/shop?category=${encodeURIComponent(c.name)}`}
              className={`group flex items-center justify-between gap-4 rounded-2xl px-5 py-4 transition-transform active:scale-[0.98] ${TINTS[i % TINTS.length]}`}
            >
              <div className="min-w-0">
                <h2 className="font-serif text-lg font-semibold text-foreground sm:text-xl">
                  {c.name}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {c.count} {c.count === 1 ? 'product' : 'products'}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <div className="flex items-center -space-x-3">
                  {c.thumbs.length > 0 ? (
                    c.thumbs.map((src, idx) => (
                      <div
                        key={idx}
                        className="relative h-14 w-14 overflow-hidden rounded-full border-2 border-background bg-muted shadow-sm sm:h-16 sm:w-16"
                        style={{ zIndex: c.thumbs.length - idx }}
                      >
                        <Image
                          src={src}
                          alt={`${c.name} product`}
                          fill
                          sizes="64px"
                          quality={70}
                          loading="lazy"
                          placeholder="blur"
                          blurDataURL={blurDataURL(32, 32)}
                          className="object-cover"
                        />
                      </div>
                    ))
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-background bg-muted text-muted-foreground sm:h-16 sm:w-16">
                      <ImageOff className="h-5 w-5" />
                    </div>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
