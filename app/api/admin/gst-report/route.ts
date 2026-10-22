import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  buildReport, monthRangeIst, sellerStateCodeFromGstin, csvB2cs, csvHsn, csv3b, csvOrders,
  type GstOrder, type GstProduct, type GstReturn, type GstConfig,
} from '@/lib/gst-report';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const verified = await verifyAdminToken(cookie);
  return verified.valid;
}

const ORDER_COLS =
  'id, created_at, status, payment_method, total_amount, gift_card_discount, shipping_charge, gst_amount, items, shipping_address, is_reseller_order, delivery_status, customer_name';

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function loadSettings(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { data } = await supabase.from('settings').select('key, value').in('key', ['store_info', 'shipping', 'gst_settings']);
  const map = new Map((data ?? []).map((r: any) => [r.key, r.value as any]));
  const store = map.get('store_info') ?? {};
  const shipping = map.get('shipping') ?? {};
  const gst = map.get('gst_settings') ?? {};
  const gstin = String(store.gstin ?? '').trim().toUpperCase();
  const cfg: GstConfig = {
    sellerStateCode: sellerStateCodeFromGstin(gstin),
    defaultRate: Number(shipping.gst_rate_percent ?? 5),
    defaultHsn: String(gst.default_hsn ?? '').trim(),
    defaultDescription: String(gst.default_description ?? 'Sarees and ethnic wear'),
  };
  return { cfg, gstin, store, gst };
}

export async function GET(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  try {
    const supabase = getSupabaseAdmin();
    const { cfg, gstin, store, gst } = await loadSettings(supabase);

    if (url.searchParams.get('view') === 'products') {
      const products = await fetchAll<any>((f, t) => supabase.from('products').select('id, name, gst_rate, hsn_code').order('name').range(f, t));
      return NextResponse.json({ products, defaults: { default_hsn: cfg.defaultHsn, default_description: cfg.defaultDescription }, gstin, storeName: store.name ?? '' });
    }

    const month = url.searchParams.get('month') ?? '';
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 });
    const { fromIso, toIso } = monthRangeIst(month);

    const orders = await fetchAll<GstOrder>((f, t) =>
      supabase.from('orders').select(ORDER_COLS).gte('created_at', fromIso).lt('created_at', toIso).order('created_at').range(f, t)
    );
    const returns = await fetchAll<GstReturn>((f, t) =>
      supabase.from('returns').select('id, order_id, type, status, refund_amount, resolved_at, created_at')
        .in('status', ['refunded', 'completed']).gte('resolved_at', fromIso).lt('resolved_at', toIso).range(f, t)
    );
    const returnOrderIds = Array.from(new Set(returns.map((r) => r.order_id)));
    const returnOrders = new Map<string, GstOrder>();
    for (let i = 0; i < returnOrderIds.length; i += 200) {
      const { data } = await supabase.from('orders').select(ORDER_COLS).in('id', returnOrderIds.slice(i, i + 200));
      (data ?? []).forEach((o: any) => returnOrders.set(o.id, o));
    }
    const products = new Map<string, GstProduct>();
    (await fetchAll<GstProduct>((f, t) => supabase.from('products').select('id, name, gst_rate, hsn_code').range(f, t))).forEach((p) => products.set(p.id, p));

    const report = buildReport({ orders, products, returns, returnOrders, cfg, gstin, from: fromIso, to: toIso });

    const fmt = url.searchParams.get('format');
    if (fmt === 'csv') {
      const type = url.searchParams.get('type');
      const body = type === 'hsn' ? csvHsn(report) : type === '3b' ? csv3b(report) : type === 'orders' ? csvOrders(report) : csvB2cs(report);
      return new NextResponse('\uFEFF' + body, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="gst-${type ?? 'b2cs'}-${month}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }
    return NextResponse.json({ month, gstin, storeName: store.name ?? '', sellerStateCode: cfg.sellerStateCode, report }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[gst-report] failed', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to build GST report' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const supabase = getSupabaseAdmin();
    if (body.action === 'save_product') {
      const rate = Number(body.gst_rate);
      if (!body.id || !Number.isFinite(rate) || ![0, 0.25, 3, 5, 12, 18, 28].includes(rate)) {
        return NextResponse.json({ error: 'Invalid product or GST rate (use 0, 3, 5, 12, 18 or 28)' }, { status: 400 });
      }
      const hsn = String(body.hsn_code ?? '').trim();
      if (hsn && !/^\d{4,8}$/.test(hsn)) return NextResponse.json({ error: 'HSN must be 4 to 8 digits' }, { status: 400 });
      const { error } = await supabase.from('products').update({ gst_rate: rate, hsn_code: hsn || null }).eq('id', body.id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }
    if (body.action === 'save_defaults') {
      const hsn = String(body.default_hsn ?? '').trim();
      if (hsn && !/^\d{4,8}$/.test(hsn)) return NextResponse.json({ error: 'HSN must be 4 to 8 digits' }, { status: 400 });
      const { error } = await supabase.from('settings').upsert(
        { key: 'gst_settings', value: { default_hsn: hsn, default_description: String(body.default_description ?? '').trim() || 'Sarees and ethnic wear' } },
        { onConflict: 'key' }
      );
      if (error) throw error;
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[gst-report] save failed', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Save failed' }, { status: 500 });
  }
}
