/**
 * Fixed, predefined measurements for each standard size. These are NOT
 * editable per-product -- an admin just picks which of these sizes apply to
 * a given product (in the product form), and the storefront's Size Chart
 * automatically shows the matching rows. "Free Size" has no fixed
 * measurements (one-size-fits-all) so it's excluded from the chart table.
 */

export type SizeChartUnit = 'cm' | 'inch';

export interface SizeChartRow {
  size: string;
  shoulder: { cm: number; inch: number };
  length: { cm: number; inch: number };
  waist: { cm: number; inch: number };
  bust: { cm: number; inch: number };
  hip: { cm: number; inch: number };
}

export const SIZE_CHART: Record<string, SizeChartRow> = {
  S: {
    size: 'S',
    shoulder: { cm: 71.1, inch: 28 },
    length: { cm: 104.1, inch: 41 },
    waist: { cm: 83.8, inch: 33 },
    bust: { cm: 91.4, inch: 36 },
    hip: { cm: 96.5, inch: 38 },
  },
  M: {
    size: 'M',
    shoulder: { cm: 73.7, inch: 29 },
    length: { cm: 104.1, inch: 41 },
    waist: { cm: 88.9, inch: 35 },
    bust: { cm: 96.5, inch: 38 },
    hip: { cm: 101.6, inch: 40 },
  },
  L: {
    size: 'L',
    shoulder: { cm: 76.2, inch: 30 },
    length: { cm: 104.1, inch: 41 },
    waist: { cm: 94, inch: 37 },
    bust: { cm: 101.6, inch: 40 },
    hip: { cm: 106.7, inch: 42 },
  },
  XL: {
    size: 'XL',
    shoulder: { cm: 81.3, inch: 32 },
    length: { cm: 104.1, inch: 41 },
    waist: { cm: 99.1, inch: 39 },
    bust: { cm: 106.7, inch: 42 },
    hip: { cm: 111.8, inch: 44 },
  },
  XXL: {
    size: 'XXL',
    shoulder: { cm: 83.8, inch: 33 },
    length: { cm: 104.1, inch: 41 },
    waist: { cm: 104.1, inch: 41 },
    bust: { cm: 111.8, inch: 44 },
    hip: { cm: 116.8, inch: 46 },
  },
};

/** The fixed, standard set of sizes an admin can pick from for a product.
 *  "Free Size" is always included/locked on -- it can't be removed. */
export const STANDARD_SIZES = ['Free Size', 'S', 'M', 'L', 'XL', 'XXL'] as const;
