import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------
// Vercel Cron (see vercel.json) — runs weekly. Same CRON_SECRET bearer
// check as app/api/cron/vendor-order-timeout/route.ts.
//
// Phase 4A point 3: groups every delivered, vendor-sourced, not-yet-
// settled order_item whose return window has passed into one
// `vendor_settlements` row per vendor, and (point 5) deducts any
// pending clawback against that vendor from a previously-paid
// settlement. All the actual grouping/eligibility logic lives in the
// `run_weekly_vendor_settlement()` Postgres function (see the Phase 4A
// migration) so it can also be re-run manually from the Supabase SQL
// editor for testing without waiting a week — this route just calls it
// via RPC (service role, so the fulfillment guard trigger's
// auth.role() = 'service_role' check passes) and reports the result.
//
// COD gating (point 4) and the return-window check both happen inside
// that SQL function, not here — nothing to duplicate in this route.
// ---------------------------------------------------------------------

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const supabase = getSupabaseAdmin();

  try {
    const { data, error } = await supabase.rpc('run_weekly_vendor_settlement');
    if (error) throw error;

    return NextResponse.json({
      success: true,
      settlements_created: data?.length ?? 0,
      settlements: data ?? [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Settlement run failed' }, { status: 500 });
  }
}
