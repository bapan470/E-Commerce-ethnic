export interface SalesTrendPoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface OrderPoint {
  id: string;
  /** exact order timestamp (ISO string) */
  time: string;
  /** exact order price/total */
  amount: number;
  status: string;
}

export interface TopProduct {
  productId: string | null;
  name: string;
  unitsSold: number;
  revenue: number;
  image: string | null;
}

export interface FunnelStage {
  stage: string;
  sessions: number;
}

export interface ProductPerformance {
  /** Row id -- the underlying product id, or `${productId}::${color}` for a
   *  colour-broken-out row (see `variantColor`). Always unique per row. */
  productId: string;
  name: string;
  /** This exact row's own product page -- the colour variant's slug for a
   *  colour row, the base product's slug otherwise. Always populated when
   *  a page exists for it, so "View" never silently disappears. */
  slug: string | null;
  image: string | null;
  /** Set when this row represents one specific colour's activity (see
   *  route.ts) rather than a whole product's combined totals -- e.g.
   *  "Maroon" for one row and "Dark Maroon" for another row of the same
   *  underlying product, each with its own impressions/etc. Null for a
   *  plain single-colour product or leftover activity with no colour
   *  metadata attached. */
  variantColor: string | null;
  impressions: number;
  /** sessions that added this product to cart, within the window */
  addToCart: number;
  /** sessions that reached checkout with this product in cart, within the window */
  beginCheckout: number;
  /** completed orders containing this product, within the window (any order
   *  that isn't cancelled/failed -- includes Cash on Delivery orders that
   *  are still 'pending' payment collection). */
  purchases: number;
  conversions: number;
  conversionRate: number;
}

export interface LowStockProduct {
  id: string;
  name: string;
  image: string | null;
  stock_quantity: number;
  low_stock_threshold: number;
  in_stock: boolean;
}

export interface AnalyticsRange {
  /** full ISO timestamp, not just a date -- preserves hour-level precision for presets like "Last 1 hour" */
  from: string;
  /** full ISO timestamp */
  to: string;
  days: number;
  hours: number;
}

export interface AnalyticsData {
  summary: {
    totalRevenue: number;
    orderCount: number;
    avgOrderValue: number;
    conversionRate: number;
    lowStockCount: number;
  };
  range: AnalyticsRange;
  salesTrend: SalesTrendPoint[];
  orders: OrderPoint[];
  topProducts: TopProduct[];
  funnel: FunnelStage[];
  lowStock: LowStockProduct[];
  /** Product Performance now shares the same [from, to] window as everything
   *  else on the dashboard -- there's a single date/time control, not a
   *  separate one just for this table. */
  productPerformance: ProductPerformance[];
}

export interface FetchAnalyticsOptions {
  /** full ISO timestamp (or yyyy-MM-dd for a whole-day range) */
  from?: string;
  /** full ISO timestamp (or yyyy-MM-dd for a whole-day range) */
  to?: string;
}

export async function fetchAnalytics(options: FetchAnalyticsOptions = {}): Promise<AnalyticsData> {
  const params = new URLSearchParams();
  if (options.from) params.set('from', options.from);
  if (options.to) params.set('to', options.to);
  const qs = params.toString();
  const res = await fetch(`/api/admin/analytics${qs ? `?${qs}` : ''}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to load analytics');
  }
  return res.json();
}
