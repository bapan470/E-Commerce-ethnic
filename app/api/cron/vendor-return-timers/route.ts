import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------
// Vercel Cron (see vercel.json) — runs once daily. Same CRON_SECRET
// bearer check as the other /api/cron/* routes in this repo.
//
// Phase 4C, point 1 — the two "Return to Vendor" timers:
//   a) Never Sold — 90 din: product still awaiting_stock/live for
//      90+ days with zero units ever sold.
//   b) Cancelled/Returned — 60 din: order item sitting cancelled/
//      returned in the warehouse for 60+ days.
// All the actual eligibility logic lives in run_return_to_vendor_scan()
// (see the Phase 4C migration) so it can also be re-run manually from
// the Supabase SQL editor for testing without waiting for a real
// timer — this route just calls it via RPC (service role) and reports
// how many new rows were flagged. It's idempotent: rows already
// flagged and still 'pending' are skipped, never duplicated.
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
    const { data, error } = await supabase.rpc('run_return_to_vendor_scan');
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;

    return NextResponse.json({
      success: true,
      never_sold_flagged: row?.never_sold_flagged ?? 0,
      cancelled_returned_flagged: row?.cancelled_returned_flagged ?? 0,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Return-timer scan failed' }, { status: 500 });
  }
}
