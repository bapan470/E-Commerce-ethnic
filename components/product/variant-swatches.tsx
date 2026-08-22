'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { fetchVariantsForProduct, ProductVariant } from '@/lib/variants-api';

export default function VariantSwatches({
  productId,
  activeSlug,
  onSelect,
  baseVariant,
}: {
  productId: string;
  /** Currently viewed variant slug, or undefined when on the base product page. */
  activeSlug?: string;
  /** Called with the clicked variant; the parent swaps images/price/sizes in place — no page navigation. */
  onSelect: (variant: ProductVariant) => void;
  /**
   * The base product's own colour, represented as a synthetic ProductVariant
   * (id: '__base__') so it can sit in this same list. A product's original
   * colour lives only on the `products` row, never in `product_variants` --
   * so without this, the moment a vendor added their first *real* variant
   * (e.g. White), the product's original colour (e.g. Green) would silently
   * vanish from the swatch list, leaving only the newly-added ones. Pass
   * `null` when the base product has no colour worth showing.
   */
  baseVariant: ProductVariant | null;
}) {
  const [fetchedVariants, setFetchedVariants] = useState<ProductVariant[]>([]);

  useEffect(() => {
    fetchVariantsForProduct(productId)
      .then(setFetchedVariants)
      .catch(() => setFetchedVariants([]));
  }, [productId]);

  // Prepend the base product's own colour, unless a real variant row
  // already represents it (matched by slug or by colour name, case-
  // insensitive) -- avoids showing the same colour twice.
  const variants = useMemo(() => {
    if (!baseVariant) return fetchedVariants;
    const alreadyRepresented = fetchedVariants.some(
      (v) =>
        v.slug === baseVariant.slug ||
        v.color.trim().toLowerCase() === baseVariant.color.trim().toLowerCase()
    );
    return alreadyRepresented ? fetchedVariants : [baseVariant, ...fetchedVariants];
  }, [fetchedVariants, baseVariant]);

  // Nothing to switch between if the vendor hasn't added any extra
  // colours yet -- same as before, only showing the base colour alone
  // would just be noise.
  if (fetchedVariants.length === 0) return null;

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
                ) : v.color_hex ? (
                  <span className="block h-full w-full" style={{ backgroundColor: v.color_hex }} />
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
