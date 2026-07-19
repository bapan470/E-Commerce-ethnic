import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendEmail } from '@/lib/email';
import { welcomeSeriesEmail, winbackEmail } from '@/lib/email-templates';

export const dynamic = 'force-dynamic';

const DEFAULT_SETTINGS = {
  welcome_enabled: false,
  welcome_delay_hours: 1,
  welcome_coupon_code: 'WELCOME10',
  winback_enabled: false,
  winback_days_inactive: 45,
  winback_coupon_code: 'COMEBACK15',
};

// Vercel Cron hits this once a day (see vercel.json). Handles two
// lifecycle emails:
//  - Welcome: sent once, `welcome_delay_hours` after signup.
//  - Win-back: sent once, to customers whose last order is older than
//    `winback_days_inactive` days.
// Both are logged in email_automation_log (unique per email+type) so a
// person is never emailed twice by the same automation.
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const supabase = getServerSupabase();
  let welcomeSent = 0;
  let winbackSent = 0;

  try {
    const { data: settingsRow } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'email_automation_settings')
      .maybeSingle();
    const settings = { ...DEFAULT_SETTINGS, ...(settingsRow?.value || {}) };

    // ---------------- Welcome series ----------------
    if (settings.welcome_enabled) {
      const admin = getSupabaseAdmin();
      const { data: userList } = await admin.auth.admin.listUsers({ perPage: 200 });
      const cutoff = Date.now() - settings.welcome_delay_hours * 60 * 60 * 1000;
      // Only consider accounts created in the last 7 days so this stays cheap
      // and doesn't rescan the whole user base every run.
      const windowStart = Date.now() - 7 * 24 * 60 * 60 * 1000;

      const candidates = (userList?.users || []).filter((u) => {
        const createdAt = new Date(u.created_at).getTime();
        return createdAt <= cutoff && createdAt >= windowStart && u.email;
      });

      for (const u of candidates) {
        const email = (u.email || '').toLowerCase();
        const { data: existing } = await supabase
          .from('email_automation_log')
          .select('id')
          .eq('email', email)
          .eq('automation_type', 'welcome')
          .maybeSingle();
        if (existing) continue;

        const { subject, html } = welcomeSeriesEmail({
          full_name: (u.user_metadata as any)?.full_name,
          coupon_code: settings.welcome_coupon_code,
        });
        const result = await sendEmail({ to: email, subject, html });
        if (result.success) {
          await supabase
            .from('email_automation_log')
            .insert({ email, user_id: u.id, automation_type: 'welcome' });
          welcomeSent++;
        }
      }
    }

    // ---------------- Win-back ----------------
    if (settings.winback_enabled) {
      const cutoffDate = new Date(
        Date.now() - settings.winback_days_inactive * 24 * 60 * 60 * 1000
      ).toISOString();

      const { data: orders } = await supabase
        .from('orders')
        .select('customer_email, customer_name, user_id, created_at')
        .not('customer_email', 'is', null)
        .order('created_at', { ascending: false });

      // Last order date per customer email.
      const lastOrderByEmail = new Map<string, { date: string; name: string | null; userId: string | null }>();
      for (const o of orders || []) {
        const email = (o.customer_email || '').toLowerCase().trim();
        if (!email || lastOrderByEmail.has(email)) continue; // orders sorted desc, first hit = latest
        lastOrderByEmail.set(email, { date: o.created_at, name: o.customer_name, userId: o.user_id });
      }

      for (const [email, info] of Array.from(lastOrderByEmail)) {
        if (info.date > cutoffDate) continue; // ordered too recently, still active

        const { data: existing } = await supabase
          .from('email_automation_log')
          .select('id')
          .eq('email', email)
          .eq('automation_type', 'winback')
          .maybeSingle();
        if (existing) continue;

        const { subject, html } = winbackEmail({
          full_name: info.name || undefined,
          coupon_code: settings.winback_coupon_code,
        });
        const result = await sendEmail({ to: email, subject, html });
        if (result.success) {
          await supabase
            .from('email_automation_log')
            .insert({ email, user_id: info.userId, automation_type: 'winback' });
          winbackSent++;
        }
      }
    }

    return NextResponse.json({ success: true, welcomeSent, winbackSent });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to run email automation';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
