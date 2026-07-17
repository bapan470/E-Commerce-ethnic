'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { fetchVariantsForProduct, ProductVariant } from '@/lib/variants-api';

export default function VariantSwatches({
  productId,
  activeSlug,
  onSelect,
}: {
  productId: string;
  /** Currently viewed variant slug, or undefined when on the base product page. */
  activeSlug?: string;
  /** Called with the clicked variant; the parent swaps images/price/sizes in place — no page navigation. */
  onSelect: (variant: ProductVariant) => void;
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
            <button
              key={v.id}
              type="button"
              onClick={() => onSelect(v)}
              title={v.color}
              aria-label={`View in ${v.color}`}
              className="group flex flex-col items-center gap-1.5"
            >
              <span
                className={`relative block h-16 w-14 shrink-0 overflow-hidden rounded-md border-2 bg-muted ${
                  isActive
                    ? 'border-primary ring-2 ring-primary/25 ring-offset-1'
                    : 'border-border/70 hover:border-primary/40'
                }`}
              >
                {thumb ? (
                  <Image
                    src={thumb}
                    alt={v.color}
                    fill
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                    sizes="56px"
                    quality={60}
                    className="select-none object-cover"
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
            </button>
          );
        })}
      </div>
    </div>
  );
}
