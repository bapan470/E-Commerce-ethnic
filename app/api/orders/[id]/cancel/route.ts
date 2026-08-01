import { NextResponse } from 'next/server';
import { getCurrentUser, getSupabaseServer } from '@/lib/supabase-server-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { fetchFulfillmentSettings } from '@/lib/marketing-api';

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
    .select('id, user_id, customer_email, status, created_at')
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

  return NextResponse.json({ success: true });
}
