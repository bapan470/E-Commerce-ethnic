import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendEmail } from '@/lib/email';
import {
  orderShippedEmail,
  orderStatusUpdateEmail,
  orderArrivingEmail,
  orderOutForDeliveryEmail,
} from '@/lib/email-templates';

// Used by the "Test" panel on Admin > Orders (see
// components/admin/delivery-notification-tester.tsx). Builds the exact same
// HTML the customer would receive for a given lifecycle email `type`,
// without writing anything to the order or emailing the real customer --
// so the admin can safely check "kaisa dikhta hai" (how does it look) as
// many times as they want. GET renders it straight in a new tab; POST sends
// it to whatever address the admin types in (e.g. their own inbox), for
// checking actual inline-CSS email-client rendering.
async function buildPreview(orderId: string, type: string, dateOverride?: string | null) {
  const supabase = getSupabaseAdmin();
  const { data: order, error } = await supabase
    .from('orders')
    .select('id, customer_name, customer_email, tracking_number, courier_name, expected_delivery_date')
    .eq('id', orderId)
    .maybeSingle();
  if (error || !order) return null;

  const testTracking = order.tracking_number || 'TEST123456789';
  const testCourier = order.courier_name || 'Delhivery';
  const testExpected =
    dateOverride ||
    order.expected_delivery_date ||
    new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  switch (type) {
    case 'shipped':
      return orderShippedEmail({
        id: order.id,
        customer_name: order.customer_name,
        tracking_number: testTracking,
        courier_name: testCourier,
      });
    case 'arriving':
      return orderArrivingEmail({
        id: order.id,
        customer_name: order.customer_name,
        expected_delivery_date: testExpected,
        courier_name: testCourier,
        tracking_number: testTracking,
      });
    case 'out_for_delivery':
      return orderOutForDeliveryEmail({
        id: order.id,
        customer_name: order.customer_name,
        courier_name: testCourier,
        tracking_number: testTracking,
      });
    case 'delivered':
    case 'paid':
    case 'cancelled':
    case 'failed':
    case 'pending':
      return orderStatusUpdateEmail({
        id: order.id,
        customer_name: order.customer_name,
        status: type,
        tracking_number: testTracking,
        courier_name: testCourier,
      });
    default:
      return null;
  }
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const verified = await verifyAdminToken(cookie);
  if (!verified.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || '';
  const date = searchParams.get('date');

  const result = await buildPreview(params.id, type, date);
  if (!result) {
    return NextResponse.json({ error: 'Unknown email type or order not found' }, { status: 400 });
  }

  return new NextResponse(result.html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const verified = await verifyAdminToken(cookie);
  if (!verified.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const type = body?.type;
  const to = body?.to;
  if (!type || !to) {
    return NextResponse.json({ error: 'Missing type or "to" email address' }, { status: 400 });
  }

  const result = await buildPreview(params.id, type, body?.date);
  if (!result) {
    return NextResponse.json({ error: 'Unknown email type or order not found' }, { status: 400 });
  }

  const sendResult = await sendEmail({ to, subject: `[TEST] ${result.subject}`, html: result.html });
  if (!sendResult.success) {
    return NextResponse.json({ error: 'error' in sendResult ? sendResult.error : 'Send failed' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
