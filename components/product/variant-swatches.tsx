'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { fetchVariantsForProduct, ProductVariant } from '@/lib/variants-api';
import { toPublicMediaUrl } from '@/lib/media-url';

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

  // Background-preload the OTHER colours' photos the moment this page is
  // viewed, so the very first colour switch is instant instead of showing
  // a network-fetch delay (that delay only ever hit the *first* switch --
  // any switch back afterwards was already browser-cached, which is why it
  // looked like it "fixed itself" after the first try). Delayed via
  // requestIdleCallback so it never competes with the current colour's own
  // photos for bandwidth/priority on first paint, and restricted to a
  // WiFi/4G-class connection -- skipped entirely on 3G, 2G, slow-2G, or
  // Data Saver, so it never costs someone on a slower/metered connection
  // any bandwidth they didn't ask for.
  const [preloadReady, setPreloadReady] = useState(false);
  useEffect(() => {
    const conn = (navigator as any).connection;
    if (conn) {
      if (conn.saveData) return;
      if (conn.effectiveType && conn.effectiveType !== '4g') return;
    }
    const idle =
      (window as any).requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1200));
    const cancelIdle = (window as any).cancelIdleCallback ?? window.clearTimeout;
    const handle = idle(() => setPreloadReady(true));
    return () => cancelIdle(handle);
  }, []);

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
    <div className="min-w-0">
      <p className="mb-2 text-sm font-semibold">
        Colour
        {activeSlug && (
          <span className="ml-1.5 font-normal text-muted-foreground">
            — {variants.find((v) => v.slug === activeSlug)?.color}
          </span>
        )}
      </p>
      {/* Mobile: one horizontally-scrollable line, same feel as the product
          gallery's thumbnail strip (no-scrollbar + native overflow-x
          scroll) instead of wrapping to a second row. Desktop keeps the
          original wrapping layout since there's usually room for it. */}
      <div className="no-scrollbar flex gap-3 overflow-x-auto sm:flex-wrap sm:overflow-visible">
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
              className="group flex shrink-0 flex-col items-center gap-1.5"
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

      {/* Invisible — never shown, never affects layout. Renders the same
          <Image> the main gallery stage renders (identical src/sizes/quality
          props, see components/product/product-gallery.tsx) so the browser
          fetches and caches the EXACT url the gallery will request once the
          shopper actually taps this colour. Only the first 2 photos per
          colour are warmed (front + back), which covers the common
          one-or-two-swipe glance without preloading a whole gallery's worth
          of photos for colours that might never get picked. */}
      {preloadReady && (
        <div aria-hidden className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0">
          {variants
            .filter((v) => v.slug !== activeSlug)
            .flatMap((v) =>
              v.images.slice(0, 2).map((raw, i) => {
                const src = toPublicMediaUrl(raw);
                if (!src) return null;
                return (
                  <div key={`${v.id}-${i}`} className="relative h-px w-px">
                    <Image
                      src={src}
                      alt=""
                      fill
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      quality={80}
                      loading="eager"
                    />
                  </div>
                );
              })
            )}
        </div>
      )}
    </div>
  );
}
