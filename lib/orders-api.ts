import { getSupabaseAdmin } from './supabase-admin';

// SECURITY NOTE: this now uses the service-role client instead of the
// anon-key client. Both callers of this file (app/api/admin/orders and
// app/api/admin/orders/[id]) already verify the admin session cookie via
// verifyAdminToken() before calling these functions, so authorization is
// unchanged. What changes is that this file no longer depends on `orders`
// having a wide-open anon RLS policy to work -- so orders' RLS can be
// safely locked down to "customers can only see their own orders"
// without breaking the admin dashboard.

// Attaches, on each order, a `_item_sources` map keyed by product_id ->
// { source_name, whatsapp_name, whatsapp_number, buy_price } — purely
// for the admin Orders panel to show "this item's product came from
// supplier X" at a glance. Reads the hidden product_sourcing /
// product_sources tables (service_role only, zero anon RLS policies —
// see 20260910000000_hidden_product_sources.sql). Never touches, and is
// never called from, anything customer-facing.
async function attachItemSources(supabase: ReturnType<typeof getSupabaseAdmin>, orders: any[]) {
  const productIds = new Set<string>();
  for (const order of orders) {
    const items = Array.isArray(order.items) ? order.items : [];
    for (const item of items) {
      if (item?.product_id) productIds.add(item.product_id);
    }
  }
  if (productIds.size === 0) return orders;

  const { data: sourcingRows, error: sourcingError } = await supabase
    .from('product_sourcing')
    .select('product_id, buy_price, product_source_id')
    .in('product_id', Array.from(productIds));
  if (sourcingError || !sourcingRows || sourcingRows.length === 0) return orders;

  const sourceIds = Array.from(
    new Set(sourcingRows.map((r) => r.product_source_id).filter((id): id is string => !!id))
  );
  let sourcesById = new Map<string, any>();
  if (sourceIds.length > 0) {
    const { data: sources } = await supabase
      .from('product_sources')
      .select('id, name, whatsapp_name, whatsapp_number')
      .in('id', sourceIds);
    sourcesById = new Map((sources ?? []).map((s) => [s.id, s]));
  }

  const byProductId = new Map(
    sourcingRows.map((r) => [
      r.product_id,
      {
        buy_price: r.buy_price,
        source_name: r.product_source_id ? sourcesById.get(r.product_source_id)?.name ?? null : null,
        whatsapp_name: r.product_source_id ? sourcesById.get(r.product_source_id)?.whatsapp_name ?? null : null,
        whatsapp_number: r.product_source_id ? sourcesById.get(r.product_source_id)?.whatsapp_number ?? null : null,
      },
    ])
  );

  return orders.map((order) => {
    const items = Array.isArray(order.items) ? order.items : [];
    const map: Record<string, any> = {};
    for (const item of items) {
      if (item?.product_id && byProductId.has(item.product_id)) {
        map[item.product_id] = byProductId.get(item.product_id);
      }
    }
    return Object.keys(map).length > 0 ? { ...order, _item_sources: map } : order;
  });
}

export async function fetchOrders() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return attachItemSources(supabase, data ?? []);
}

export async function updateOrderStatus(id: string, status: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('orders').update({ status }).eq('id', id);
  if (error) throw error;
  return data;
}

// Bulk delete -- used by the admin "select rows -> Delete Selected" action.
// Related rows (returns, tracking events, etc.) are cleaned up automatically
// by the ON DELETE CASCADE / SET NULL constraints already defined on the
// orders foreign keys, so a plain delete here is safe.
export async function deleteOrders(ids: string[]) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('orders').delete().in('id', ids).select('id');
  if (error) throw error;
  return data;
}
