import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const REVENUE_STATUSES = ['paid', 'shipped', 'delivered'];
const EXCLUDED_ORDER_STATUSES = ['cancelled', 'failed'];
const DEFAULT_RANGE_DAYS = 30;
const MAX_RANGE_DAYS = 365;
const MAX_ORDER_POINTS = 1000;
const ALLOWED_PERF_DAYS = [7, 30, 90];

function dayKey(dateStr: string) {
  return new Date(dateStr).toISOString().slice(0, 10);
}

/**
 * Reads `?from=YYYY-MM-DD&to=YYYY-MM-DD` from the request. Falls back to the
 * last 30 days (inclusive of today) when either is missing or invalid, so
 * every existing caller that doesn't pass a range keeps working unchanged.
 */
function parseRange(url: URL) {
  const fromParam = url.searchParams.get('from');
  const toParam = url.searchParams.get('to');

  let to = toParam ? new Date(`${toParam}T23:59:59.999Z`) : new Date();
  let from = fromParam
    ? new Date(`${fromParam}T00:00:00.000Z`)
    : (() => {
        const d = new Date(to);
        d.setUTCDate(d.getUTCDate() - (DEFAULT_RANGE_DAYS - 1));
        d.setUTCHours(0, 0, 0, 0);
        return d;
      })();

  const invalid = isNaN(from.getTime()) || isNaN(to.getTime()) || from > to;
  if (invalid) {
    to = new Date();
    from = new Date(to);
    from.setUTCDate(from.getUTCDate() - (DEFAULT_RANGE_DAYS - 1));
    from.setUTCHours(0, 0, 0, 0);
  }

  const rangeDays = Math.min(
    MAX_RANGE_DAYS,
    Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1)
  );

  return { from, to, rangeDays };
}

export async function GET(req: Request) {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const verified = await verifyAdminToken(cookie);
  if (!verified.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const { from, to, rangeDays } = parseRange(url);

  // `?days=7|30|90` only controls the Product Performance table's window
  // below -- it's independent of the `from`/`to` sales-trend date range.
  const requestedDays = Number(url.searchParams.get('days'));
  const perfDays = ALLOWED_PERF_DAYS.includes(requestedDays) ? requestedDays : DEFAULT_RANGE_DAYS;

  try {
    const supabase = getSupabaseAdmin();

    const perfSince = new Date();
    perfSince.setDate(perfSince.getDate() - perfDays);

    // Fetch events far enough back to cover whichever window is larger, then
    // filter in-memory per section below so a wider Product Performance
    // window never leaks into the selected-range funnel/summary numbers.
    const fetchSince = perfSince < from ? perfSince : from;

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

    // ---------------- Orders that fall inside the selected date range ----------------
    const ordersInRange = orders.filter((o) => {
      if (!o.created_at) return false;
      const t = new Date(o.created_at).getTime();
      return t >= from.getTime() && t <= to.getTime();
    });

    // ---------------- Sales trend (one bucket per day across the range) ----------------
    const trendMap = new Map<string, { revenue: number; orders: number }>();
    for (let i = 0; i < rangeDays; i++) {
      const d = new Date(from);
      d.setUTCDate(d.getUTCDate() + i);
      trendMap.set(d.toISOString().slice(0, 10), { revenue: 0, orders: 0 });
    }
    let totalRevenue = 0;
    let orderCount = 0;
    for (const o of ordersInRange) {
      const key = dayKey(o.created_at);
      const bucket = trendMap.get(key);
      if (!bucket) continue;
      if (!EXCLUDED_ORDER_STATUSES.includes(o.status)) {
        bucket.orders += 1;
        orderCount += 1;
      }
      if (REVENUE_STATUSES.includes(o.status)) {
        bucket.revenue += o.total_amount || 0;
        totalRevenue += o.total_amount || 0;
      }
    }
    const salesTrend = Array.from(trendMap.entries()).map(([date, v]) => ({
      date,
      revenue: v.revenue,
      orders: v.orders,
    }));

    // ---------------- Individual orders: exact time + price for the chart ----------------
    // Every order in the selected range, with its precise timestamp and
    // amount, so the chart can plot (and the tooltip can show) the exact
    // order time and price rather than only a per-day average.
    const orderPoints = ordersInRange
      .filter((o) => !EXCLUDED_ORDER_STATUSES.includes(o.status))
      .map((o) => ({
        id: o.id,
        time: o.created_at,
        amount: o.total_amount || 0,
        status: o.status,
      }))
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
      .slice(-MAX_ORDER_POINTS);

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

    // ---------------- Conversion funnel (session-based, selected range) ----------------
    const eventsInRange = events.filter(
      (ev) => ev.created_at && new Date(ev.created_at) >= from && new Date(ev.created_at) <= to
    );
    const sessionsByStage: Record<string, Set<string>> = {
      page_view: new Set(),
      product_view: new Set(),
      add_to_cart: new Set(),
      checkout_start: new Set(),
      purchase: new Set(),
    };
    for (const ev of eventsInRange) {
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

    // ---------------- Low stock alerts (always all-time, not range-bound) ----------------
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
      const countedInThisOrder = new Set<string>();
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
        totalRevenue,
        orderCount,
        avgOrderValue: orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0,
        conversionRate,
        lowStockCount: lowStock.length,
      },
      range: {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
        days: rangeDays,
      },
      salesTrend,
      orders: orderPoints,
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
