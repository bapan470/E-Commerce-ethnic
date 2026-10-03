import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// Admin > Orders > "Revert to COD" -- the undo of "Request Online Payment".
//
// Use case: admin asked the customer to pay online (payment_method flipped
// 'cod' -> 'online', total_amount reduced by the online-payment discount),
// but the customer never paid and the admin now wants to ship it as plain
// COD via Delhivery after all.
//
// What it does (exact inverse of request-online-payment/route.ts):
//   1. payment_method 'online' -> 'cod'
//   2. total_amount += online_payment_discount  (back to the COD price the
//      customer originally agreed to), online_payment_discount -> 0
//   3. status stays 'pending'
// After this, "Create Shipment" sends Delhivery payment_mode = COD with
// cod_amount = the full COD price, and the rate shown in the popup is the
// COD rate instead of the prepaid one.
//
// Safety: refuses if the customer has already paid (razorpay_payment_id set
// or status 'paid'), if the order isn't pending, or if it wasn't originally
// a COD order. Also refuses once a shipment/tracking number exists.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const verified = await verifyAdminToken(cookie);
  if (!verified.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data: order, error } = await supabase
    .from('orders')
    .select(
      'id, status, payment_method, original_payment_method, total_amount, online_payment_discount, razorpay_payment_id, tracking_number'
    )
    .eq('id', params.id)
    .maybeSingle();

  if (error || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }
  if (order.payment_method === 'cod') {
    return NextResponse.json({ error: 'This order is already COD' }, { status: 409 });
  }
  if (order.original_payment_method !== 'cod') {
    return NextResponse.json(
      { error: 'Only an order that was originally placed as COD can be reverted to COD' },
      { status: 409 }
    );
  }
  if (order.razorpay_payment_id || order.status === 'paid') {
    return NextResponse.json(
      { error: 'The customer has already paid online — this order cannot be reverted to COD' },
      { status: 409 }
    );
  }
  if (order.status !== 'pending') {
    return NextResponse.json(
      { error: 'Only a pending order can be reverted to COD' },
      { status: 409 }
    );
  }
  if (order.tracking_number) {
    return NextResponse.json(
      { error: 'A shipment already exists for this order' },
      { status: 409 }
    );
  }

  const discount = Number(order.online_payment_discount ?? 0);
  const restoredTotal = Number(order.total_amount) + discount;

  const { error: updateError } = await supabase
    .from('orders')
    .update({
      payment_method: 'cod',
      total_amount: restoredTotal,
      online_payment_discount: 0,
    })
    .eq('id', order.id)
    .eq('status', 'pending')
    .eq('payment_method', order.payment_method);

  if (updateError) {
    console.error('[revert-to-cod] update failed:', updateError);
    return NextResponse.json({ error: 'Failed to revert the order to COD' }, { status: 500 });
  }

  return NextResponse.json({ success: true, total_amount: restoredTotal });
}
