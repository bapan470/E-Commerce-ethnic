/**
 * Server-side utility to fetch popularity rankings
 * This allows us to pass the initial popularity data from the server
 * to the client, so the first page paint shows products in the right order.
 */

import { getServerSupabase } from '@/lib/supabase-server';

const WEIGHTS: Record<string, number> = {
  purchase: 100,
  checkout_start: 30,
  add_to_cart: 10,
  product_view: 1,
};

export async function fetchPopularityRankServer(): Promise<Map<string, number>> {
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

    // Sort descending by score and create map
    const ranked = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);

    // Return as Map<productId, rankIndex>
    return new Map(ranked.map((id, i) => [id, i]));
  } catch (err) {
    console.error('[fetchPopularityRankServer] error', err);
    return new Map();
  }
}
