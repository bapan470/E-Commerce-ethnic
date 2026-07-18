export interface SalesTrendPoint {
  date: string;
  revenue: number;
  orders: number;
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

export interface LowStockProduct {
  id: string;
  name: string;
  image: string | null;
  stock_quantity: number;
  low_stock_threshold: number;
  in_stock: boolean;
}

export interface AnalyticsData {
  summary: {
    totalRevenue30d: number;
    orderCount30d: number;
    avgOrderValue30d: number;
    conversionRate: number;
    lowStockCount: number;
  };
  salesTrend: SalesTrendPoint[];
  topProducts: TopProduct[];
  funnel: FunnelStage[];
  lowStock: LowStockProduct[];
}

export async function fetchAnalytics(): Promise<AnalyticsData> {
  const res = await fetch('/api/admin/analytics');
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to load analytics');
  }
  return res.json();
}
