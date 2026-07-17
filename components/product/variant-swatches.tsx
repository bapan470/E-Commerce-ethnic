'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { fetchVariantsForProduct, ProductVariant } from '@/lib/variants-api';

export default function VariantSwatches({
  productId,
  activeSlug,
  fallbackHref,
}: {
  productId: string;
  /** Currently viewed variant slug, or undefined when on the base product page. */
  activeSlug?: string;
  /** Link for the base/default product colour (the main product slug). */
  fallbackHref: string;
}) {
  const [variants, setVariants] = useState<ProductVariant[]>([]);

  useEffect(() => {
    fetchVariantsForProduct(productId)
      .then(setVariants)
      .catch(() => setVariants([]));
  }, [productId]);

  if (variants.length === 0) return null;

  return (
    <div>
      <p className="mb-2 text-sm font-semibold">
        Colour
        {activeSlug && (
          <span className="ml-1.5 font-normal text-muted-foreground">
            — {variants.find((v) => v.slug === activeSlug)?.color}
          </span>
        )}
      </p>
      <div className="flex flex-wrap gap-3">
        {variants.map((v) => {
          const isActive = v.slug === activeSlug;
          const thumb = v.images[0];
          return (
            <Link
              key={v.id}
              href={`/product/${v.slug}`}
              replace
              title={v.color}
              aria-label={`View in ${v.color}`}
              className="group flex flex-col items-center gap-1.5"
            >
              <span
                className={`relative block h-16 w-14 shrink-0 overflow-hidden rounded-md border-2 bg-muted transition-all group-hover:opacity-90 ${
                  isActive
                    ? 'border-primary ring-2 ring-primary/25 ring-offset-1'
                    : 'border-border/70'
                }`}
              >
                {thumb ? (
                  <Image
                    src={thumb}
                    alt={v.color}
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase text-muted-foreground">
                    {v.color.slice(0, 2)}
                  </span>
                )}
              </span>
              <span
                className={`max-w-[4rem] truncate text-[11px] ${
                  isActive ? 'font-semibold text-primary' : 'text-muted-foreground'
                }`}
              >
                {v.color}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
