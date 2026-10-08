import { getSupabaseAdmin } from '@/lib/supabase-admin';

// Google Merchant Center "Promotions" feed (tab-separated .txt).
//
// Add this URL in Merchant Center -> Marketing -> Promotions ->
// Add promotions -> "Add promotions from a file" -> "Enter a link to your file":
//   https://www.aruhihandlooms.com/api/promotions-feed
//
// ONLY coupons where Admin -> Coupons -> "Google Promotions" toggle is ON
// (show_in_google_promotions = true) are included. On top of that a coupon
// must be active, not expired and not out of usage.
//
// Always dynamic so toggling a coupon in Admin shows up on Google's next
// fetch (Merchant Center re-fetches every 24 hours).
export const dynamic = 'force-dynamic';

interface CouponRow {
  id: string;
  code: string;
  discount_type: 'percentage' | 'flat';
  discount_value: number;
  min_order_value: number | null;
  usage_limit: number | null;
  times_used: number | null;
  expires_at: string | null;
  is_active: boolean;
}

const IST_OFFSET_MIN = 330; // +05:30
const DEFAULT_WINDOW_DAYS = 30; // used for coupons with no expiry date

const COLUMNS = [
  'promotion_id',
  'product_applicability',
  'offer_type',
  'long_title',
  'promotion_effective_dates',
  'redemption_channel',
  'generic_redemption_code',
  'percent_off',
  'money_off_amount',
  'minimum_purchase_amount',
  'promotion_destination',
];

// Format a Date as ISO-8601 in IST, e.g. 2026-10-08T00:00:00+05:30
function toIst(d: Date): string {
  const shifted = new Date(d.getTime() + IST_OFFSET_MIN * 60_000);
  return shifted.toISOString().replace(/\.\d{3}Z$/, '') + '+05:30';
}

function clean(v: string): string {
  return v.replace(/[\t\r\n]+/g, ' ').trim();
}

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('coupons')
    .select('id, code, discount_type, discount_value, min_order_value, usage_limit, times_used, expires_at, is_active')
    .eq('show_in_google_promotions', true)
    .eq('is_active', true);

  if (error) {
    return new Response(`Failed to load coupons: ${error.message}`, { status: 500 });
  }

  const now = new Date();
  // Start of today in IST (promotion must not start in the future relative to feed fetch)
  const istNow = new Date(now.getTime() + IST_OFFSET_MIN * 60_000);
  istNow.setUTCHours(0, 0, 0, 0);
  const startOfToday = new Date(istNow.getTime() - IST_OFFSET_MIN * 60_000);

  const rows: string[] = [COLUMNS.join('\t')];

  for (const c of (data ?? []) as CouponRow[]) {
    const expiresAt = c.expires_at ? new Date(c.expires_at) : null;
    if (expiresAt && expiresAt.getTime() <= now.getTime()) continue; // expired
    if (c.usage_limit != null && (c.times_used ?? 0) >= c.usage_limit) continue; // used up
    if (!c.discount_value || c.discount_value <= 0) continue;

    const end = expiresAt ?? new Date(startOfToday.getTime() + DEFAULT_WINDOW_DAYS * 86_400_000);
    const code = clean(c.code);
    const minOrder = c.min_order_value && c.min_order_value > 0 ? `${c.min_order_value} INR` : '';

    let title: string;
    let percentOff = '';
    let moneyOff = '';
    if (c.discount_type === 'percentage') {
      percentOff = String(Math.round(c.discount_value));
      title = `${percentOff}% off with code ${code}`;
    } else {
      moneyOff = `${c.discount_value} INR`;
      title = `Rs ${c.discount_value} off with code ${code}`;
    }
    if (c.min_order_value && c.min_order_value > 0) title += ` on orders above Rs ${c.min_order_value}`;

    rows.push(
      [
        `COUPON-${code}`.slice(0, 50).replace(/[^A-Za-z0-9_-]/g, '-'),
        'ALL_PRODUCTS',
        'GENERIC_CODE',
        clean(title).slice(0, 60),
        `${toIst(startOfToday)}/${toIst(end)}`,
        'ONLINE',
        code,
        percentOff,
        moneyOff,
        minOrder,
        'Shopping_ads,Free_listings',
      ].join('\t')
    );
  }

  return new Response(rows.join('\n') + '\n', {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
    },
  });
}
