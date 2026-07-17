import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { getServerSupabase } from '@/lib/supabase-server';

export async function GET() {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const verified = await verifyAdminToken(cookie);
  if (!verified.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();

  try {
    const { data: returns, error } = await supabase
      .from('returns')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;

    // Attach a bit of order context (customer + total) so the admin panel
    // doesn't need a second round trip per row.
    const orderIds = Array.from(new Set((returns || []).map((r) => r.order_id)));
    let ordersById: Record<string, any> = {};
    if (orderIds.length > 0) {
      const { data: orders } = await supabase
        .from('orders')
        .select('id, customer_name, customer_email, total_amount, items')
        .in('id', orderIds);
      ordersById = Object.fromEntries((orders || []).map((o) => [o.id, o]));
    }

    const enriched = (returns || []).map((r) => ({
      ...r,
      order: ordersById[r.order_id] || null,
    }));

    return NextResponse.json({ returns: enriched });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to load returns' }, { status: 500 });
  }
}
