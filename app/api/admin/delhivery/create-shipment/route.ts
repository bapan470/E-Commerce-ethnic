import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { createDelhiveryShipment } from '@/lib/delhivery-api';
import { sendEmail } from '@/lib/email';
import { orderShippedEmail } from '@/lib/email-templates';

export async function POST(req: Request) {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const verified = await verifyAdminToken(cookie);
  if (!verified.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const orderId = body?.orderId;
  if (!orderId) {
    return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
  }

  const packageDetails =
    body?.weight_grams && body?.length_cm && body?.width_cm && body?.height_cm
      ? {
          weight_grams: Number(body.weight_grams),
          length_cm: Number(body.length_cm),
          width_cm: Number(body.width_cm),
          height_cm: Number(body.height_cm),
          shipping_mode: body.shipping_mode === 'E' ? ('E' as const) : ('S' as const),
        }
      : undefined;

  const supabase = getServerSupabase();

  try {
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.tracking_number) {
      return NextResponse.json(
        { error: `Order already has a tracking number (${order.tracking_number})` },
        { status: 400 }
      );
    }

    const result = await createDelhiveryShipment(
      {
        id: order.id,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        total_amount: order.total_amount,
        payment_method: order.payment_method,
        items: Array.isArray(order.items) ? order.items : [],
        shipping_address: order.shipping_address,
      },
      packageDetails
    );

    if (!result.success || !result.waybill) {
      return NextResponse.json(
        { error: result.remark || 'Delhivery did not return a waybill' },
        { status: 502 }
      );
    }

    // Bump status forward to 'shipped' unless it's already further along
    // (delivered/cancelled) or explicitly still awaiting payment collection.
    const nextStatus = ['pending', 'paid'].includes(order.status) ? 'shipped' : order.status;

    const { error: updateError } = await supabase
      .from('orders')
      .update({
        tracking_number: result.waybill,
        courier_name: 'Delhivery',
        status: nextStatus,
      })
      .eq('id', orderId);

    if (updateError) throw updateError;

    if (order.customer_email) {
      const { subject, html } = orderShippedEmail({
        id: order.id,
        customer_name: order.customer_name,
        tracking_number: result.waybill,
        courier_name: 'Delhivery',
      });
      // Best-effort — a failed email shouldn't undo the shipment creation.
      sendEmail({ to: order.customer_email, subject, html }).catch(() => {});
    }

    return NextResponse.json({ success: true, waybill: result.waybill, status: nextStatus });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create shipment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
