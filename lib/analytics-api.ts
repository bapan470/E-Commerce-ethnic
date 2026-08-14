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
  productId: string;
  name: string;
  image: string | null;
  impressions: number;
  /** sessions that added this product to cart, within the window */
  addToCart: number;
  /** sessions that reached checkout with this product in cart, within the window */
  beginCheckout: number;
  /** completed orders containing this product, within the window */
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
  from: string;
  to: string;
  days: number;
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
  productPerformance: ProductPerformance[];
  productPerformanceDays: number | null;
  productPerformanceHours: number | null;
}

export interface FetchAnalyticsOptions {
  /** yyyy-MM-dd */
  from?: string;
  /** yyyy-MM-dd */
  to?: string;
  /** window (7 | 30 | 90) for the Product Performance table only */
  productPerformanceDays?: number;
  /** window (1 | 6 | 12 | 24) for the Product Performance table only -- takes priority over productPerformanceDays when set */
  productPerformanceHours?: number;
}

export async function fetchAnalytics(options: FetchAnalyticsOptions = {}): Promise<AnalyticsData> {
  const params = new URLSearchParams();
  if (options.from) params.set('from', options.from);
  if (options.to) params.set('to', options.to);
  if (options.productPerformanceHours) {
    params.set('hours', String(options.productPerformanceHours));
  } else if (options.productPerformanceDays) {
    params.set('days', String(options.productPerformanceDays));
  }
  const qs = params.toString();
  const res = await fetch(`/api/admin/analytics${qs ? `?${qs}` : ''}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to load analytics');
  }
  return res.json();
}
