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

export interface ProductPerformanceTopVariant {
  /** Colour name, e.g. "Maroon" */
  color: string;
  image: string | null;
  /** Slug of this exact colour's product page -- null if it can't be resolved. */
  slug: string | null;
  impressions: number;
  addToCart: number;
  beginCheckout: number;
  purchases: number;
}

export interface ProductPerformance {
  productId: string;
  name: string;
  /** Base product's own slug, e.g. for linking the product name/thumbnail. */
  slug: string | null;
  image: string | null;
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
  /** The best-performing colour variation for this product (ranked Purchase
   *  > Begin checkout > Add to cart > Impressions), when the product has
   *  more than one colour with recorded activity. Null for single-colour
   *  products or when no colour data is available yet. */
  topVariant: ProductPerformanceTopVariant | null;
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
