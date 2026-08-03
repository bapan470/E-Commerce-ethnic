import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendEmail } from '@/lib/email';
import { TRACKING_PIXEL_PLACEHOLDER } from '@/lib/campaign-templates';

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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
  const hasPixelPlaceholder = html.includes(TRACKING_PIXEL_PLACEHOLDER);

  for (const c of customers ?? []) {
    if (!c.email || alreadySentIds.has(c.id)) {
      skipped += 1;
      continue;
    }

    // Each send gets its own row id up front so it can double as a unique,
    // unguessable open-tracking id embedded directly in that recipient's
    // copy of the email (a shared/static pixel would only tell us "someone
    // opened one of the emails", not who).
    const sendId = randomUUID();
    const perRecipientHtml = hasPixelPlaceholder
      ? html.replace(
          TRACKING_PIXEL_PLACEHOLDER,
          `<img src="${siteUrl}/api/track/open/${sendId}" width="1" height="1" alt="" style="display:block; border:0;" />`
        )
      : html;

    const result = await sendEmail({ to: c.email, subject, html: perRecipientHtml });
    const status = result.success ? 'sent' : 'skipped' in result && result.skipped ? 'skipped' : 'failed';
    if (status === 'sent') sent += 1;
    else if (status === 'failed') failed += 1;
    else skipped += 1;

    await supabase.from('woocommerce_campaign_sends').insert({
      id: sendId,
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

// GET /api/admin/woocommerce-import/send-campaign — campaign history grouped
// by subject, with open counts, so the admin can see whether a campaign
// (including one sent from the premium template picker) is actually being
// opened, not just "sent".
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('woocommerce_campaign_sends')
    .select('subject, status, opened_at, sent_at')
    .order('sent_at', { ascending: false })
    .limit(2000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const bySubject = new Map<
    string,
    { subject: string; sent: number; failed: number; skipped: number; opened: number; lastSentAt: string }
  >();

  for (const row of data ?? []) {
    const entry = bySubject.get(row.subject) ?? {
      subject: row.subject,
      sent: 0,
      failed: 0,
      skipped: 0,
      opened: 0,
      lastSentAt: row.sent_at,
    };
    if (row.status === 'sent') entry.sent += 1;
    else if (row.status === 'failed') entry.failed += 1;
    else entry.skipped += 1;
    if (row.opened_at) entry.opened += 1;
    if (row.sent_at > entry.lastSentAt) entry.lastSentAt = row.sent_at;
    bySubject.set(row.subject, entry);
  }

  const campaigns = Array.from(bySubject.values()).sort(
    (a, b) => new Date(b.lastSentAt).getTime() - new Date(a.lastSentAt).getTime()
  );

  return NextResponse.json({ campaigns });
}
