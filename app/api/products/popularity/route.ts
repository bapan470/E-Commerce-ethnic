import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';

/**
 * GET /api/products/popularity
 *
 * Returns a list of product IDs ordered by their total "product_view"
 * event count over the last 30 days (most-viewed first).
 *
 * Response: { ranked: string[] }  — array of product_id strings, most
 * popular first. Products with zero views are not included; the caller
 * should fall back to any remaining products appended at the end.
 *
 * Cached by Next.js for 10 minutes (revalidate: 600) so every shop
 * page load doesn't hit the database with a heavy aggregation query.
 */
export const revalidate = 600; // 10 minutes

export async function GET() {
  try {
    const supabase = getServerSupabase();

    // Count product_view events per product over the last 30 days.
    // We use a raw RPC or a plain select — Supabase JS client supports
    // .select() with group-by via a view, but the simplest portable
    // approach here is to pull the raw rows and aggregate in JS.
    // For even large catalogs (< 10k rows/day) this is fast enough and
    // avoids needing a custom DB function.
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('activity_events')
      .select('product_id')
      .eq('event_type', 'product_view')
      .gte('created_at', since)
      .not('product_id', 'is', null);

    if (error) throw error;

    // Tally view counts per product id
    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      if (row.product_id) {
        counts[row.product_id] = (counts[row.product_id] ?? 0) + 1;
      }
    }

    // Sort descending by count
    const ranked = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);

    return NextResponse.json({ ranked });
  } catch (err) {
    console.error('[popularity] error', err);
    // Return empty list on error — callers fall back to default sort
    return NextResponse.json({ ranked: [] });
  }
}
