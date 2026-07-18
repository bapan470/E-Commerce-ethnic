import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { getServerSupabase } from '@/lib/supabase-server';

const REVENUE_STATUSES = ['paid', 'shipped', 'delivered'];
const EXCLUDED_ORDER_STATUSES = ['cancelled', 'failed'];
const TREND_DAYS = 30;

function dayKey(dateStr: string) {
  return new Date(dateStr).toISOString().slice(0, 10);
}

export async function GET() {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const verified = await verifyAdminToken(cookie);
  if (!verified.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getServerSupabase();

    const since = new Date();
    since.setDate(since.getDate() - TREND_DAYS);

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
        .select('session_id, event_type, created_at')
        .gte('created_at', since.toISOString()),
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
    const sessionsByStage: Record<string, Set<string>> = {
      page_view: new Set(),
      product_view: new Set(),
      add_to_cart: new Set(),
      checkout_start: new Set(),
      purchase: new Set(),
    };
    for (const ev of events) {
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
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 });
  }
}
