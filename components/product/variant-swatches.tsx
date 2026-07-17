'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchVariantsForProduct, ProductVariant } from '@/lib/variants-api';

// Best-effort colour-name -> swatch mapping for common saree/ethnic-wear
// colours. Falls back to a neutral dot if the name isn't recognised.
const COLOR_MAP: Record<string, string> = {
  red: '#c0392b',
  maroon: '#7b241c',
  pink: '#e195ab',
  magenta: '#c2185b',
  orange: '#e67e22',
  yellow: '#f1c40f',
  mustard: '#c9a316',
  gold: '#d4af37',
  green: '#27ae60',
  olive: '#6b8e23',
  teal: '#16a085',
  blue: '#2980b9',
  navy: '#1a2a4a',
  purple: '#8e44ad',
  black: '#1c1c1c',
  white: '#f5f5f0',
  cream: '#f2e8d5',
  ivory: '#fffff0',
  grey: '#95a5a6',
  gray: '#95a5a6',
  brown: '#7a5230',
  beige: '#d8c3a5',
  silver: '#c0c0c0',
};

function swatchColor(name: string): string {
  const key = name.toLowerCase().trim();
  for (const [k, v] of Object.entries(COLOR_MAP)) {
    if (key.includes(k)) return v;
  }
  return '#b0a99f';
}

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
      <p className="mb-2 text-sm font-semibold">Colour</p>
      <div className="flex flex-wrap gap-2.5">
        {variants.map((v) => {
          const isActive = v.slug === activeSlug;
          return (
            <Link
              key={v.id}
              href={`/product/${v.slug}`}
              title={v.color}
              aria-label={`View in ${v.color}`}
              className={`relative flex h-9 w-9 items-center justify-center rounded-full border-2 transition-transform hover:scale-105 ${
                isActive ? 'border-primary' : 'border-border'
              }`}
            >
              <span
                className="h-6 w-6 rounded-full border border-black/10"
                style={{ backgroundColor: swatchColor(v.color) }}
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
