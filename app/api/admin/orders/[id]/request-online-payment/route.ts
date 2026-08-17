import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendEmail } from '@/lib/email';
import { codToPrepaidRequestEmail } from '@/lib/email-templates';
import { logPaymentRequestEvent } from '@/lib/order-payment-events';

// Admin > Orders > "Request Online Payment" -- for a COD order whose item
// isn't kept ready-made (needs to be prepared before it can ship), this
// converts the order from COD to "pay online first":
//   1. Flips payment_method 'cod' -> 'online' (status stays 'pending'),
//      which is the exact combination /checkout/resume/[id] and
//      /api/razorpay/create-order already require -- so the customer's
//      normal Razorpay flow just works from here with no other changes.
//   2. Emails the customer an apology + a link to that resume-payment
//      page (codToPrepaidRequestEmail).
// Once they actually pay, /api/razorpay/verify-payment takes over as
// usual: status -> 'paid', and the customer gets the existing "payment
// confirmed, we're preparing it" email + the account/track page banner.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const verified = await verifyAdminToken(cookie);
  if (!verified.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data: order, error } = await supabase
    .from('orders')
    .select('id, status, payment_method, items, total_amount, customer_name, customer_email')
    .eq('id', params.id)
    .maybeSingle();

  if (error || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }
  if (order.status !== 'pending' || order.payment_method !== 'cod') {
    return NextResponse.json(
      { error: 'Only a COD order that is still pending can be converted to online payment' },
      { status: 409 }
    );
  }
  if (!order.customer_email) {
    return NextResponse.json({ error: 'This order has no customer email to send the request to' }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({ payment_method: 'online' })
    .eq('id', order.id)
    .eq('status', 'pending');
  if (updateError) {
    return NextResponse.json({ error: 'Failed to update the order' }, { status: 500 });
  }

  // Marks the moment the admin clicked this button -- this row's
  // created_at is "kab admin ne request kiya". Also unlocks the
  // razorpay create-order/verify-payment routes below to log this
  // order's later payment attempts (they're gated on a 'requested' row
  // existing, so ordinary online checkouts never get logged here).
  await logPaymentRequestEvent(order.id, 'requested');

  // Reserve the tracking row BEFORE building the email, since its id gets
  // embedded in the email itself (open pixel + click-through link) --
  // see lib/email-templates.ts -> codToPrepaidRequestEmail.
  const { data: sentEvent } = await supabase
    .from('order_payment_request_events')
    .insert({ order_id: order.id, event_type: 'email_sent' })
    .select('id')
    .maybeSingle();
  const trackingId = sentEvent?.id;

  const { subject, html } = codToPrepaidRequestEmail({
    id: order.id,
    items: Array.isArray(order.items) ? order.items : [],
    total_amount: order.total_amount,
    customer_name: order.customer_name,
    trackingId,
  });
  const sendResult = await sendEmail({ to: order.customer_email, subject, html });
  if (!sendResult.success) {
    await logPaymentRequestEvent(order.id, 'email_send_failed', {
      meta: { error: 'error' in sendResult ? String(sendResult.error) : 'Email failed to send' },
    });
    // The order is already converted at this point -- don't silently
    // leave the admin thinking nothing happened, but don't roll back
    // either (they can use "Send test" / resend some other way).
    return NextResponse.json(
      { success: true, emailed: false, error: 'error' in sendResult ? sendResult.error : 'Email failed to send' },
      { status: 200 }
    );
  }

  return NextResponse.json({ success: true, emailed: true });
}
