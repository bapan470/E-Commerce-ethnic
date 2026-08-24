/**
 * Enhanced Server-side utility to fetch popularity rankings
 * Tracks clicks, views, purchases, and other engagement metrics
 * Products with highest engagement appear at the top of shop/category pages
 */

import { getServerSupabase } from '@/lib/supabase-server';

// Weights for different engagement metrics
// Purchases are most valuable, followed by checkouts, cart adds, and views
const WEIGHTS: Record<string, number> = {
  purchase: 100,        // Highest priority - actual sales
  checkout_start: 30,   // Customer was ready to buy
  add_to_cart: 10,      // Customer showed interest
  product_view: 1,      // Basic engagement
  product_click: 2,     // User clicked on product
  wishlist_add: 5,      // Customer saved for later
};

// Time windows for different metrics (in days)
const WEIGHT_DECAY = {
  recent_days: 7,       // Recent engagement (last 7 days) - full weight
  medium_days: 30,      // Medium term (7-30 days) - 0.7x weight
  older_days: 90,       // Older (30-90 days) - 0.3x weight
};

interface PopularityScore {
  productId: string;
  score: number;
  purchaseCount: number;
  viewCount: number;
  cartCount: number;
  lastActivity: string;
}

/**
 * Calculate time decay factor for older events
 * Recent events get full weight, older events get reduced weight
 */
function getDecayFactor(createdAt: string): number {
  const eventDate = new Date(createdAt);
  const now = new Date();
  const daysDiff = (now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24);

  if (daysDiff <= WEIGHT_DECAY.recent_days) {
    return 1.0; // Full weight for recent events
  } else if (daysDiff <= WEIGHT_DECAY.medium_days) {
    return 0.7; // 70% weight for medium-term events
  } else if (daysDiff <= WEIGHT_DECAY.older_days) {
    return 0.3; // 30% weight for older events
  }
  return 0; // No weight for events older than 90 days
}

export async function fetchPopularityRankServer(): Promise<Map<string, number>> {
  try {
    const supabase = getServerSupabase();

    // Fetch events from the last 90 days (older events have minimal weight anyway)
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch all relevant events
    const { data, error } = await supabase
      .from('activity_events')
      .select('product_id, event_type, created_at')
      .in('event_type', [
        'purchase',
        'checkout_start',
        'add_to_cart',
        'product_view',
        'product_click',
        'wishlist_add',
      ])
      .gte('created_at', since)
      .not('product_id', 'is', null);

    if (error) throw error;

    // Compute weighted score per product with time decay
    const scores: Record<string, PopularityScore> = {};
    
    for (const row of data ?? []) {
      if (!row.product_id) continue;

      const baseWeight = WEIGHTS[row.event_type] ?? 0;
      const decayFactor = getDecayFactor(row.created_at);
      const weight = baseWeight * decayFactor;

      if (!scores[row.product_id]) {
        scores[row.product_id] = {
          productId: row.product_id,
          score: 0,
          purchaseCount: 0,
          viewCount: 0,
          cartCount: 0,
          lastActivity: row.created_at,
        };
      }

      scores[row.product_id].score += weight;

      // Track specific metrics for filtering/analytics
      if (row.event_type === 'purchase') {
        scores[row.product_id].purchaseCount++;
      } else if (row.event_type === 'product_view') {
        scores[row.product_id].viewCount++;
      } else if (row.event_type === 'add_to_cart') {
        scores[row.product_id].cartCount++;
      }

      // Update last activity timestamp (keep the latest)
      if (new Date(row.created_at) > new Date(scores[row.product_id].lastActivity)) {
        scores[row.product_id].lastActivity = row.created_at;
      }
    }

    // Sort by score descending and create map with rankings
    const ranked = Object.values(scores)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.productId);

    // Return as Map<productId, rankIndex> where 0 = most popular
    return new Map(ranked.map((id, i) => [id, i]));
  } catch (err) {
    console.error('[fetchPopularityRankServer] error', err);
    return new Map();
  }
}

/**
 * Get detailed popularity metrics for a specific product
 * Useful for showing "X people are viewing this" or similar badges
 */
export async function fetchProductPopularityMetrics(
  productId: string
): Promise<{
  viewCount: number;
  purchaseCount: number;
  cartCount: number;
  isTrending: boolean;
}> {
  try {
    const supabase = getServerSupabase();

    // Last 7 days for trending calculation
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('activity_events')
      .select('event_type')
      .eq('product_id', productId)
      .gte('created_at', since);

    if (error) throw error;

    const events = data ?? [];
    const viewCount = events.filter((e) => e.event_type === 'product_view').length;
    const purchaseCount = events.filter((e) => e.event_type === 'purchase').length;
    const cartCount = events.filter((e) => e.event_type === 'add_to_cart').length;

    // Trending if has high engagement in recent week
    const isTrending =
      purchaseCount >= 3 || (viewCount >= 50 && cartCount >= 5) || purchaseCount > 0;

    return {
      viewCount,
      purchaseCount,
      cartCount,
      isTrending,
    };
  } catch (err) {
    console.error('[fetchProductPopularityMetrics] error', err);
    return {
      viewCount: 0,
      purchaseCount: 0,
      cartCount: 0,
      isTrending: false,
    };
  }
}

/**
 * Get top N products by popularity
 * Useful for homepage featured sections, ads, recommendations
 */
export async function fetchTopPopularProducts(limit: number = 10): Promise<string[]> {
  try {
    const rank = await fetchPopularityRankServer();
    return Array.from(rank.keys()).slice(0, limit);
  } catch (err) {
    console.error('[fetchTopPopularProducts] error', err);
    return [];
  }
}
