import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const REVENUE_STATUSES = ['paid', 'shipped', 'delivered'];
const EXCLUDED_ORDER_STATUSES = ['cancelled', 'failed'];
const TREND_DAYS = 30;
const ALLOWED_PERF_DAYS = [7, 30, 90];

function dayKey(dateStr: string) {
  return new Date(dateStr).toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const verified = await verifyAdminToken(cookie);
  if (!verified.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // `?days=7|30|90` only controls the Product Performance table's window
  // below -- the rest of the dashboard (sales trend, funnel, summary cards)
  // intentionally stays pinned to the fixed last-30-days view.
  const url = new URL(req.url);
  const requestedDays = Number(url.searchParams.get('days'));
  const perfDays = ALLOWED_PERF_DAYS.includes(requestedDays) ? requestedDays : TREND_DAYS;

  try {
    const supabase = getSupabaseAdmin();

    const since = new Date();
    since.setDate(since.getDate() - TREND_DAYS);

    const perfSince = new Date();
    perfSince.setDate(perfSince.getDate() - perfDays);

    // Fetch events far enough back to cover whichever window is larger, then
    // filter in-memory per section below so a wider Product Performance
    // window never leaks into the fixed 30-day funnel/summary numbers.
    const fetchSince = perfSince < since ? perfSince : since;

    const [ordersRes, productsRes, eventsRes] = await Promise.all([
      supabase
        .from('orders')
        .select('id, items, total_amount, status, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('products')
        .select('id, name, images, stock_quantity, low_stock_threshold, in_stock')
        .order('stock_quantity', { ascending: true }),
      supabase
        .from('activity_events')
        .select('session_id, event_type, product_id, created_at')
        .gte('created_at', fetchSince.toISOString()),
    ]);

    if (ordersRes.error) throw ordersRes.error;
    if (productsRes.error) throw productsRes.error;
    if (eventsRes.error) throw eventsRes.error;

    const orders = ordersRes.data ?? [];
    const products = productsRes.data ?? [];
    const events = eventsRes.data ?? [];

    // ---------------- Sales trend (last 30 days) ----------------
    const trendMap = new Map<string, { revenue: number; orders: number }>();
    for (let i = TREND_DAYS - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      trendMap.set(d.toISOString().slice(0, 10), { revenue: 0, orders: 0 });
    }
    let totalRevenue30d = 0;
    let orderCount30d = 0;
    for (const o of orders) {
      if (!o.created_at) continue;
      const key = dayKey(o.created_at);
      const bucket = trendMap.get(key);
      if (!bucket) continue; // outside the 30-day window
      if (!EXCLUDED_ORDER_STATUSES.includes(o.status)) {
        bucket.orders += 1;
        orderCount30d += 1;
      }
      if (REVENUE_STATUSES.includes(o.status)) {
        bucket.revenue += o.total_amount || 0;
        totalRevenue30d += o.total_amount || 0;
      }
    }
    const salesTrend = Array.from(trendMap.entries()).map(([date, v]) => ({
      date,
      revenue: v.revenue,
      orders: v.orders,
    }));

    // ---------------- Top products (all-time, by revenue) ----------------
    const productAgg = new Map<
      string,
      { productId: string | null; name: string; unitsSold: number; revenue: number; image: string | null }
    >();
    for (const o of orders) {
      if (!REVENUE_STATUSES.includes(o.status)) continue;
      const items = Array.isArray(o.items) ? o.items : [];
      for (const it of items) {
        const key = it.product_id || it.product_name;
        if (!key) continue;
        const existing = productAgg.get(key) || {
          productId: it.product_id ?? null,
          name: it.product_name || 'Unknown product',
          unitsSold: 0,
          revenue: 0,
          image: it.image_url ?? null,
        };
        existing.unitsSold += it.quantity || 0;
        existing.revenue += (it.price || 0) * (it.quantity || 0);
        if (!existing.image && it.image_url) existing.image = it.image_url;
        productAgg.set(key, existing);
      }
    }
    const topProducts = Array.from(productAgg.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // ---------------- Conversion funnel (session-based, last 30 days) ----------------
    const eventsInTrendWindow = events.filter((ev) => ev.created_at && new Date(ev.created_at) >= since);
    const sessionsByStage: Record<string, Set<string>> = {
      page_view: new Set(),
      product_view: new Set(),
      add_to_cart: new Set(),
      checkout_start: new Set(),
      purchase: new Set(),
    };
    for (const ev of eventsInTrendWindow) {
      if (sessionsByStage[ev.event_type]) sessionsByStage[ev.event_type].add(ev.session_id);
    }
    const funnel = [
      { stage: 'Visited', sessions: sessionsByStage.page_view.size },
      { stage: 'Viewed a product', sessions: sessionsByStage.product_view.size },
      { stage: 'Added to cart', sessions: sessionsByStage.add_to_cart.size },
      { stage: 'Started checkout', sessions: sessionsByStage.checkout_start.size },
      { stage: 'Purchased', sessions: sessionsByStage.purchase.size },
    ];
    const conversionRate =
      sessionsByStage.page_view.size > 0
        ? Number(((sessionsByStage.purchase.size / sessionsByStage.page_view.size) * 100).toFixed(1))
        : 0;

    // ---------------- Low stock alerts ----------------
    const lowStock = products
      .filter((p) => p.stock_quantity <= (p.low_stock_threshold ?? 5))
      .map((p) => ({
        id: p.id,
        name: p.name,
        image: p.images?.[0] ?? null,
        stock_quantity: p.stock_quantity,
        low_stock_threshold: p.low_stock_threshold ?? 5,
        in_stock: p.in_stock,
      }));

    // ---------------- Product performance: Impressions vs Conversion (perfDays window) ----------------
    // "Impressions" = how many times the product page was viewed (product_view
    // events). "Conversion" = what share of those views turned into an order
    // containing that product, within the same window. Same idea as the
    // per-product report Google Merchant Center shows -- built from data we
    // already track (activity_events + orders.items), no new tracking needed.
    const eventsInPerfWindow = events.filter((ev) => ev.created_at && new Date(ev.created_at) >= perfSince);
    const productViewCounts = new Map<string, number>();
    for (const ev of eventsInPerfWindow) {
      if (ev.event_type !== 'product_view' || !ev.product_id) continue;
      productViewCounts.set(ev.product_id, (productViewCounts.get(ev.product_id) ?? 0) + 1);
    }
    const productPurchaseCounts = new Map<string, number>();
    for (const o of orders) {
      if (!REVENUE_STATUSES.includes(o.status)) continue;
      if (!o.created_at || new Date(o.created_at) < perfSince) continue;
      const items = Array.isArray(o.items) ? o.items : [];
      const countedInThisOrder = new Set<string>(); // one order buying 2x the same product still counts as 1 conversion
      for (const it of items) {
        if (!it.product_id || countedInThisOrder.has(it.product_id)) continue;
        countedInThisOrder.add(it.product_id);
        productPurchaseCounts.set(it.product_id, (productPurchaseCounts.get(it.product_id) ?? 0) + 1);
      }
    }
    const productPerformance = products
      .map((p) => {
        const impressions = productViewCounts.get(p.id) ?? 0;
        const conversions = productPurchaseCounts.get(p.id) ?? 0;
        return {
          productId: p.id,
          name: p.name,
          image: p.images?.[0] ?? null,
          impressions,
          conversions,
          conversionRate: impressions > 0 ? Number(((conversions / impressions) * 100).toFixed(2)) : 0,
        };
      })
      .filter((p) => p.impressions > 0)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 25);

    return NextResponse.json({
      summary: {
        totalRevenue30d,
        orderCount30d,
        avgOrderValue30d: orderCount30d > 0 ? Math.round(totalRevenue30d / orderCount30d) : 0,
        conversionRate,
        lowStockCount: lowStock.length,
      },
      salesTrend,
      topProducts,
      funnel,
      lowStock,
      productPerformance,
      productPerformanceDays: perfDays,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 });
  }
}
