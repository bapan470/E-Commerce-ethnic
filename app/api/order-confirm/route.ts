import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/email';
import { orderConfirmationEmail } from '@/lib/email-templates';

// Called from the checkout page right after an order is created/confirmed
// (both COD and post-payment). Sends the order confirmation email and, if
// this customer had an abandoned-cart row, marks it recovered so the
// recovery cron leaves it alone.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const orderId = body?.orderId;
  if (!orderId) {
    return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
  }

  const supabase = getServerSupabase();

  try {
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.customer_email) {
      const { subject, html } = orderConfirmationEmail({
        id: order.id,
        customer_name: order.customer_name,
        items: Array.isArray(order.items) ? order.items : [],
        total_amount: order.total_amount,
        payment_method: order.payment_method,
      });
      await sendEmail({ to: order.customer_email, subject, html });

      // Best-effort: this customer just checked out, so any abandoned cart
      // row tied to their email is no longer "abandoned".
      await supabase
        .from('abandoned_carts')
        .update({ recovered: true })
        .eq('email', order.customer_email)
        .eq('recovered', false);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send confirmation email';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
