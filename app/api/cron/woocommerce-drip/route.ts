import { NextResponse } from 'next/server';
import { runWooCommerceDripJob } from '@/lib/cron-jobs';

export const dynamic = 'force-dynamic';

// Also run automatically as part of /api/cron/daily-jobs (once/day, see
// vercel.json). This route is kept so the admin/dev can trigger the
// welcome/follow-up drip manually — useful right after turning the
// automation toggle on, instead of waiting for the next scheduled tick.
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
