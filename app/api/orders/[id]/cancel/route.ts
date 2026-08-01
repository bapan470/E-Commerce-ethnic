import { NextResponse } from 'next/server';
import { getCurrentUser, getSupabaseServer } from '@/lib/supabase-server-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { fetchFulfillmentSettings } from '@/lib/marketing-api';
import { refundRazorpayPayment } from '@/lib/razorpay-refund';

// Statuses a customer is still allowed to self-cancel from. Once an order
// has moved past this (shipped/delivered/etc.) it must go through the
// return/exchange flow instead, not a plain cancellation.
const CANCELLABLE_STATUSES = ['pending', 'paid', 'confirmed'];

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'You must be logged in to cancel an order.' }, { status: 401 });
  }

  // Use the auth-aware client only to confirm the order belongs to this
  // customer (RLS-scoped read), then use the admin client for the actual
  // status write so we don't depend on an RLS UPDATE policy existing.
  const supabase = await getSupabaseServer();
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('id, user_id, customer_email, status, created_at, payment_method, razorpay_payment_id, total_amount')
    .eq('id', params.id)
    .single();

  if (fetchError || !order) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }

  const ownsByEmail =
    !!order.customer_email && !!user.email && order.customer_email.toLowerCase() === user.email.toLowerCase();
  if (order.user_id !== user.id && !ownsByEmail) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }

  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    return NextResponse.json(
      { error: 'This order can no longer be cancelled online. Please contact us for help.' },
      { status: 400 }
    );
  }

  const { cancellation_window_hours } = await fetchFulfillmentSettings();
  const hoursSinceOrder = (Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60);
  if (hoursSinceOrder > cancellation_window_hours) {
    return NextResponse.json(
      {
        error: `The ${cancellation_window_hours}-hour cancellation window for this order has passed. Please contact us for help.`,
      },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdmin();
  const { error: updateError } = await admin
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', order.id);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to cancel order. Please try again or contact us.' }, { status: 500 });
  }

  // Only orders that actually had money captured need a refund. A COD
  // order, or an "online" order where Razorpay's verify-payment step never
  // ran (no razorpay_payment_id / not actually 'paid'), never took money
  // in the first place — nothing to refund.
  const needsRefund = order.payment_method === 'online' && order.status === 'paid' && !!order.razorpay_payment_id;

  if (!needsRefund) {
    return NextResponse.json({ success: true, refunded: false });
  }

  const { data: refundSettingRow } = await admin
    .from('settings')
    .select('value')
    .eq('key', 'refund_automation')
    .maybeSingle();
  const autoRefundEnabled = (refundSettingRow?.value as { auto_refund_enabled?: boolean } | null)
    ?.auto_refund_enabled ?? true; // default on, matches DEFAULT_REFUND_AUTOMATION_SETTINGS

  if (!autoRefundEnabled) {
    await admin.from('orders').update({ refund_status: 'pending_manual' }).eq('id', order.id);
    return NextResponse.json({
      success: true,
      refunded: false,
      refundError: 'Your order was cancelled. Our team will process your refund manually within 1-2 business days.',
    });
  }

  const refundResult = await refundRazorpayPayment(order.razorpay_payment_id, order.total_amount);

  if (refundResult.success) {
    await admin
      .from('orders')
      .update({ refund_status: 'refunded', razorpay_refund_id: refundResult.refundId })
      .eq('id', order.id);
    return NextResponse.json({ success: true, refunded: true });
  }

  // The order is still cancelled even if the refund call failed — we
  // don't want to block cancellation on Razorpay being reachable. We just
  // flag it so the admin can see it needs a manual refund instead of it
  // silently getting missed.
  await admin.from('orders').update({ refund_status: 'failed' }).eq('id', order.id);
  return NextResponse.json({
    success: true,
    refunded: false,
    refundError: 'Your order was cancelled, but the automatic refund failed. Our team will process your refund manually within 1-2 business days.',
  });
}
