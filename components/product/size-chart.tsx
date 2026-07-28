'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { SIZE_CHART, SizeChartUnit } from '@/lib/size-chart';

interface Props {
  /** The sizes this specific product offers (product.sizes). Only the ones
   *  with a fixed entry in SIZE_CHART (S/M/L/XL/XXL) get a row -- "Free Size"
   *  has no fixed measurements so it's skipped automatically. */
  sizes: string[];
}

const HOW_TO_MEASURE: { label: string; tip: string }[] = [
  { label: 'Shoulder', tip: 'Measure straight across the back, from one shoulder edge to the other.' },
  { label: 'Length', tip: 'Measure from the shoulder seam down to where you want the hem to fall.' },
  { label: 'Waist', tip: 'Measure around the narrowest part of your natural waistline.' },
  { label: 'Bust', tip: 'Wrap the tape around the fullest part of your chest, keeping it level.' },
  { label: 'Hip', tip: 'Measure around the fullest part of your hips, roughly 8 inches below your waist.' },
];

export default function SizeChart({ sizes }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'dimensions' | 'measure'>('dimensions');
  const [unit, setUnit] = useState<SizeChartUnit>('cm');

  const rows = sizes.map((s) => SIZE_CHART[s]).filter(Boolean);
  if (rows.length === 0) return null;

  return (
    <div className="border-t border-border pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-sm font-semibold"
      >
        Size Chart
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex gap-4 border-b border-border text-sm">
            <button
              type="button"
              onClick={() => setTab('dimensions')}
              className={`-mb-px border-b-2 pb-2 font-medium transition-colors ${
                tab === 'dimensions'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Product Dimensions
            </button>
            <button
              type="button"
              onClick={() => setTab('measure')}
              className={`-mb-px border-b-2 pb-2 font-medium transition-colors ${
                tab === 'measure'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              How to Measure
            </button>
          </div>

          {tab === 'dimensions' ? (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Select measurement unit:</span>
                <div className="flex overflow-hidden rounded-md border border-primary">
                  <button
                    type="button"
                    onClick={() => setUnit('inch')}
                    className={`px-3 py-1 font-medium transition-colors ${
                      unit === 'inch' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    inch
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnit('cm')}
                    className={`px-3 py-1 font-medium transition-colors ${
                      unit === 'cm' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    cm
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-xs">
                  <thead>
                    <tr className="bg-muted/50 text-left">
                      <th className="p-2 font-semibold">Size</th>
                      <th className="p-2 font-semibold">Shoulder ({unit})</th>
                      <th className="p-2 font-semibold">Length ({unit})</th>
                      <th className="p-2 font-semibold">Waist ({unit})</th>
                      <th className="p-2 font-semibold">Bust ({unit})</th>
                      <th className="p-2 font-semibold">Hip ({unit})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.size} className="border-t border-border">
                        <td className="p-2 font-bold">{r.size}</td>
                        <td className="p-2 text-muted-foreground">{r.shoulder[unit]}</td>
                        <td className="p-2 text-muted-foreground">{r.length[unit]}</td>
                        <td className="p-2 text-muted-foreground">{r.waist[unit]}</td>
                        <td className="p-2 text-muted-foreground">{r.bust[unit]}</td>
                        <td className="p-2 text-muted-foreground">{r.hip[unit]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <ul className="space-y-2 text-xs text-muted-foreground">
              {HOW_TO_MEASURE.map((item) => (
                <li key={item.label}>
                  <span className="font-semibold text-foreground">{item.label}: </span>
                  {item.tip}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
