import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendEmail } from '@/lib/email';

async function requireAdmin() {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const verified = await verifyAdminToken(cookie);
  return verified.valid;
}

// Sends `html` (with an auto-appended unsubscribe/footer line) to every
// selected imported customer, one email at a time via the store's already
// configured provider (Admin -> Settings -> Email Notifications). Every
// send is logged to woocommerce_campaign_sends so the same subject is
// never re-sent to the same person twice.
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { customerIds?: string[]; subject?: string; html?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { customerIds, subject, html } = body;
  if (!customerIds?.length || !subject || !html) {
    return NextResponse.json({ error: 'customerIds, subject and html are required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: customers, error } = await supabase
    .from('woocommerce_customers')
    .select('id, email')
    .in('id', customerIds);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Don't re-send the same subject to someone already emailed for this campaign.
  const { data: alreadySent } = await supabase
    .from('woocommerce_campaign_sends')
    .select('customer_id')
    .eq('subject', subject)
    .eq('status', 'sent')
    .in('customer_id', customerIds);
  const alreadySentIds = new Set((alreadySent ?? []).map((r) => r.customer_id));

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const c of customers ?? []) {
    if (!c.email || alreadySentIds.has(c.id)) {
      skipped += 1;
      continue;
    }

    const result = await sendEmail({ to: c.email, subject, html });
    const status = result.success ? 'sent' : 'skipped' in result && result.skipped ? 'skipped' : 'failed';
    if (status === 'sent') sent += 1;
    else if (status === 'failed') failed += 1;
    else skipped += 1;

    await supabase.from('woocommerce_campaign_sends').insert({
      customer_id: c.id,
      email: c.email,
      subject,
      status,
      error: result.success ? null : String((result as any).error ?? ''),
    });

    // Gentle pacing so we don't hammer the email provider's rate limit.
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  return NextResponse.json({ sent, failed, skipped });
}
