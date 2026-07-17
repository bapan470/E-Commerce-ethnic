import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/email';
import { cartRecoveryEmail } from '@/lib/email-templates';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const verified = await verifyAdminToken(cookie);
  if (!verified.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();

  try {
    const { data: cart, error } = await supabase
      .from('abandoned_carts')
      .select('*')
      .eq('id', params.id)
      .single();
    if (error || !cart) {
      return NextResponse.json({ error: 'Cart not found' }, { status: 404 });
    }
    if (!cart.email) {
      return NextResponse.json({ error: 'This cart has no email on file' }, { status: 400 });
    }

    const { subject, html } = cartRecoveryEmail({
      items: Array.isArray(cart.items) ? cart.items : [],
      cart_value: cart.cart_value,
    });
    const result = await sendEmail({ to: cart.email, subject, html });
    if (!result.success) {
      return NextResponse.json({ error: 'Failed to send email' }, { status: 502 });
    }

    await supabase
      .from('abandoned_carts')
      .update({ recovery_email_sent: true, recovery_email_sent_at: new Date().toISOString() })
      .eq('id', params.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to send recovery email' }, { status: 500 });
  }
}
