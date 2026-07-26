import { getSupabaseAdmin } from './supabase-admin';

// SECURITY NOTE: this now uses the service-role client instead of the
// anon-key client. Both callers of this file (app/api/admin/orders and
// app/api/admin/orders/[id]) already verify the admin session cookie via
// verifyAdminToken() before calling these functions, so authorization is
// unchanged. What changes is that this file no longer depends on `orders`
// having a wide-open anon RLS policy to work -- so orders' RLS can be
// safely locked down to "customers can only see their own orders"
// without breaking the admin dashboard.
export async function fetchOrders() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function updateOrderStatus(id: string, status: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('orders').update({ status }).eq('id', id);
  if (error) throw error;
  return data;
}
