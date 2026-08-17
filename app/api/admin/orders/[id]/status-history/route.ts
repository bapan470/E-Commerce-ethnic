import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// Returns the full status timeline for one order, oldest first. Two
// sources get merged into one list, each timestamped independently:
//   1. order_status_history -- populated automatically by the
//      trg_log_order_status_change trigger (see
//      20260921020000_order_status_history.sql) whenever `orders.status`
//      changes, from ANY code path (admin dropdown, Razorpay
//      verify-payment, Delhivery create-shipment, etc.).
//   2. order_payment_request_events, 'requested' rows only -- written by
//      Admin > "Request Online Payment" itself (see
//      app/api/admin/orders/[id]/request-online-payment), so that click
//      shows up on this same timeline with its own time/date instead of
//      only being visible as a payment_method flip with no record of
//      when/why it happened.
// The order's original_payment_method (set once at placement by a DB
// trigger, see 20260923000000_orders_original_payment_method.sql) is
// also returned so the UI can label the very first "pending" entry as
// "Order placed (COD)" / "Order placed (Prepaid)" instead of a bare
// "Order placed".
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const verified = await verifyAdminToken(cookie);
  if (!verified.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  try {
    const [{ data: statusRows, error: statusError }, { data: requestRows, error: requestError }, { data: order }] =
      await Promise.all([
        admin
          .from('order_status_history')
          .select('id, from_status, to_status, changed_at')
          .eq('order_id', params.id)
          .order('changed_at', { ascending: true }),
        admin
          .from('order_payment_request_events')
          .select('id, created_at')
          .eq('order_id', params.id)
          .eq('event_type', 'requested')
          .order('created_at', { ascending: true }),
        admin.from('orders').select('original_payment_method').eq('id', params.id).maybeSingle(),
      ]);
    if (statusError) throw statusError;
    if (requestError) throw requestError;

    const statusEntries = (statusRows || []).map((row) => ({
      id: row.id,
      kind: 'status' as const,
      from_status: row.from_status,
      to_status: row.to_status,
      changed_at: row.changed_at,
    }));
    const requestEntries = (requestRows || []).map((row) => ({
      id: row.id,
      kind: 'payment_request' as const,
      from_status: null,
      to_status: null,
      changed_at: row.created_at,
    }));

    const history = [...statusEntries, ...requestEntries].sort(
      (a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime()
    );

    return NextResponse.json({
      success: true,
      history,
      original_payment_method: order?.original_payment_method ?? null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to load status history' }, { status: 500 });
  }
}
