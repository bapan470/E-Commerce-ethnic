import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/email';
import { cartRecoveryEmail } from '@/lib/email-templates';

export const dynamic = 'force-dynamic';

// Vercel Cron (see vercel.json) hits this with GET. If you set CRON_SECRET
// in your env vars, Vercel automatically sends it as a Bearer token and we
// verify it here so randoms on the internet can't trigger this endpoint.
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const supabase = getServerSupabase();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  try {
    const { data: carts, error } = await supabase
      .from('abandoned_carts')
      .select('*')
      .eq('recovery_email_sent', false)
      .eq('recovered', false)
      .not('email', 'is', null)
      .lte('last_activity_at', oneHourAgo);

    if (error) throw error;

    let sent = 0;
    for (const cart of carts || []) {
      const { subject, html } = cartRecoveryEmail({
        items: Array.isArray(cart.items) ? cart.items : [],
        cart_value: cart.cart_value,
      });
      const result = await sendEmail({ to: cart.email, subject, html });
      if (result.success) {
        await supabase
          .from('abandoned_carts')
          .update({ recovery_email_sent: true, recovery_email_sent_at: new Date().toISOString() })
          .eq('id', cart.id);
        sent++;
      }
    }

    return NextResponse.json({ success: true, checked: carts?.length || 0, sent });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to process abandoned carts';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
