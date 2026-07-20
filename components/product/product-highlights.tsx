'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Product } from '@/lib/types';

interface Row {
  label: string;
  value?: string | null;
}

function Cell({ label, value }: Row) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

/**
 * "Product Highlights" spec block, styled after the familiar marketplace
 * layout: a few key attributes always visible (Color, Fabric, Fit/Shape,
 * Length), with a "Additional Details" chevron that expands the rest.
 * Fields are populated by the AI listing generator in admin, with graceful
 * fallbacks to the product's existing fabric/pattern/occasion/colour data
 * for older listings that don't have `highlights` filled in yet.
 */
export default function ProductHighlights({ product, activeColor }: { product: Product; activeColor?: string }) {
  const [expanded, setExpanded] = useState(false);
  const h = product.highlights || {};

  const color = activeColor || product.colors[0];

  const primaryRows: Row[] = [
    { label: 'Color', value: color },
    { label: 'Fabric', value: product.fabric },
    { label: 'Fit / Shape', value: h.fit_shape },
    { label: 'Length', value: h.length },
  ].filter((r) => r.value);

  const detailRows: Row[] = [
    { label: 'Neck', value: h.neck },
    { label: 'Print or Pattern Type', value: h.print_or_pattern_type || product.pattern },
    { label: 'Surface Styling', value: h.surface_styling },
    { label: 'Occasion', value: product.occasion.join(', ') },
    { label: 'Sleeve Length', value: h.sleeve_length },
    { label: 'Sleeve Styling', value: h.sleeve_styling },
    { label: 'Net Quantity', value: h.net_quantity },
    { label: 'Add On', value: h.add_on },
    { label: 'Type', value: h.type },
    { label: 'Generic Name', value: h.generic_name },
    { label: 'Country of Origin', value: h.country_of_origin },
    { label: 'Transparency', value: h.transparency },
  ].filter((r) => r.value);

  if (primaryRows.length === 0 && detailRows.length === 0) return null;

  return (
    <div className="rounded-lg border border-border/60 bg-card p-4">
      <p className="mb-3 font-serif text-base font-semibold text-primary">Product Highlights</p>

      {primaryRows.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {primaryRows.map((r) => (
            <Cell key={r.label} {...r} />
          ))}
        </div>
      )}

      {detailRows.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-4 flex w-full items-center justify-between border-t border-border/60 pt-3 text-sm font-semibold text-primary"
          >
            Additional Details
            <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
          {expanded && (
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
              {detailRows.map((r) => (
                <Cell key={r.label} {...r} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
