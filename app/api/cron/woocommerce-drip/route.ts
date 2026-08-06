import { NextResponse } from 'next/server';
import { runWooCommerceDripJob } from '@/lib/cron-jobs';

export const dynamic = 'force-dynamic';
// Vercel Hobby budget: 60s. Enqueue step (DB reads/writes for 27k+ customers)
// alone can take 5-15s, leaving ~45s for the actual send loop (12 emails * ~3s
// each = ~36s). Keep MAX_SEND_PER_RUN at 12 so this comfortably fits under 60s
// even with Vercel cold-start overhead.
export const maxDuration = 60;

// Also run automatically as part of /api/cron/daily-jobs (once/day, see
// vercel.json). This route is kept so the admin/dev can trigger the
// welcome/follow-up drip manually — useful right after turning the
// automation toggle on, instead of waiting for the next scheduled tick.
//
// Cron-job.org triggers this every 15 min (during the 1hr send window)
// with a Bearer token. Max timeout on cron-job.org is 30s — the function
// itself may run up to 60s, but cron-job.org will mark it "timeout" after
// 30s. That is FINE: Vercel keeps running the function to completion even
// after cron-job.org closes the connection. Emails still get sent.
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const result = await runWooCommerceDripJob();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to run WooCommerce drip job';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
