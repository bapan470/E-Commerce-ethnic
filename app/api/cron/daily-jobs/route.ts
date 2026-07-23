import { NextResponse } from 'next/server';
import {
  runAbandonedCartsJob,
  runEmailAutomationJob,
  runVendorReturnTimersJob,
  runVendorSettlementJob,
  runStuckVendorListingsJob,
} from '@/lib/cron-jobs';

export const dynamic = 'force-dynamic';
// runStuckVendorListingsJob (one of the jobs run below) now retries AI
// generation for a small batch of recovered products before falling
// back, which can take a while — give this route the full Vercel Hobby
// budget so it isn't killed mid-batch.
export const maxDuration = 60;

// ---------------------------------------------------------------------
// Consolidated daily cron.
//
// Vercel's Hobby (free) plan allows only 2 cron jobs, running once a
// day each. This repo originally had 5 separate crons, so 4 of them
// (all except vendor-order-timeout, which has its own daily cron) are
// combined here and run one after another:
//   1. abandoned-carts     (was: daily)
//   2. email-automation    (was: daily)
//   3. vendor-return-timers (was: daily)
//   4. vendor-settlement   (was: weekly — only actually runs on Mondays
//      here, so the cadence stays the same even though this route is
//      hit every day)
//
// Each job is wrapped in try/catch so one failing job doesn't stop the
// others from running. See vercel.json for the schedule and
// lib/cron-jobs.ts for the actual job logic (unchanged from before).
// ---------------------------------------------------------------------
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const results: Record<string, any> = {};

  try {
    results.abandonedCarts = await runAbandonedCartsJob();
  } catch (err: any) {
    results.abandonedCarts = { error: err?.message || 'Failed' };
  }

  try {
    results.emailAutomation = await runEmailAutomationJob();
  } catch (err: any) {
    results.emailAutomation = { error: err?.message || 'Failed' };
  }

  try {
    results.vendorReturnTimers = await runVendorReturnTimersJob();
  } catch (err: any) {
    results.vendorReturnTimers = { error: err?.message || 'Failed' };
  }

  try {
    results.stuckVendorListings = await runStuckVendorListingsJob();
  } catch (err: any) {
    results.stuckVendorListings = { error: err?.message || 'Failed' };
  }

  // Weekly settlement: only run it on Mondays so behaviour matches the
  // old "0 3 * * 1" (weekly, Monday) schedule even though this route
  // itself is hit daily.
  const today = new Date().getUTCDay(); // 0 = Sunday, 1 = Monday, ...
  if (today === 1) {
    try {
      results.vendorSettlement = await runVendorSettlementJob();
    } catch (err: any) {
      results.vendorSettlement = { error: err?.message || 'Failed' };
    }
  } else {
    results.vendorSettlement = { skipped: 'not Monday' };
  }

  return NextResponse.json({ success: true, results });
}
