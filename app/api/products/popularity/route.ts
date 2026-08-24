import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';

/**
 * GET /api/products/popularity
 *
 * Returns product IDs ranked by a weighted popularity score over the
 * last 30 days, using this priority order:
 *
 *   purchase        → 100 points  (strongest signal: someone actually bought it)
 *   checkout_start  →  30 points  (strong intent: entered checkout)
 *   add_to_cart     →  10 points  (moderate intent: added to cart)
 *   product_view    →   1 point   (weak signal: clicked/viewed the product)
 *
 * Response: { ranked: string[] }  — product_id strings, highest score first.
 * Products with zero events are not included; callers append them at the end.
 *
 * Cached for 10 minutes so the aggregation query doesn't run on every
 * page load.
 */
export const revalidate = 600; // 10 minutes

const WEIGHTS: Record<string, number> = {
  purchase: 100,
  checkout_start: 30,
  add_to_cart: 10,
  product_view: 1,
};

export async function GET() {
  try {
    const supabase = getServerSupabase();

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch all relevant events in one query
    const { data, error } = await supabase
      .from('activity_events')
      .select('product_id, event_type')
      .in('event_type', ['purchase', 'checkout_start', 'add_to_cart', 'product_view'])
      .gte('created_at', since)
      .not('product_id', 'is', null);

    if (error) throw error;

    // Compute weighted score per product
    const scores: Record<string, number> = {};
    for (const row of data ?? []) {
      if (!row.product_id) continue;
      const weight = WEIGHTS[row.event_type] ?? 0;
      scores[row.product_id] = (scores[row.product_id] ?? 0) + weight;
    }

    // Sort descending by score
    const ranked = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);

    return NextResponse.json({ ranked });
  } catch (err) {
    console.error('[popularity] error', err);
    return NextResponse.json({ ranked: [] });
  }
}
