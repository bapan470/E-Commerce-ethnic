import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// Returns the full status timeline for one order, oldest first -- populated
// automatically by the trg_log_order_status_change trigger (see
// supabase/migrations/20260921020000_order_status_history.sql) whenever
// `orders.status` changes, from ANY code path (admin dropdown, Razorpay
// verify-payment, Delhivery create-shipment, etc.).
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const verified = await verifyAdminToken(cookie);
  if (!verified.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  try {
    const { data, error } = await admin
      .from('order_status_history')
      .select('id, from_status, to_status, changed_at')
      .eq('order_id', params.id)
      .order('changed_at', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ success: true, history: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to load status history' }, { status: 500 });
  }
}
