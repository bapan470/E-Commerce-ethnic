import { getSupabaseAdmin } from './supabase-admin';
import { sendEmail } from './email';
import { orderStatusUpdateEmail } from './email-templates';
import { isInPaymentRequestFlow } from './order-payment-events';

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

// Attaches, on each order, the latest linked `returns` row's status and
// refund_status (as `_return_status` / `_return_refund_status`) — purely
// for the admin Orders panel's Refund column. Needed because a return's
// refund only ever updates the `returns` row (see
// lib/return-automation.ts / app/api/admin/returns/[id]/refund), never
// orders.refund_status — that column is exclusively written by the
// customer self-CANCELLATION flow (app/api/orders/[id]/cancel). Showing
// only orders.refund_status in the admin panel would silently miss every
// refund that came through a return/exchange instead of a cancellation.
// "Latest" = most recently created return for that order, since an order
// can in principle have more than one return row (e.g. a rejected return
// followed by a fresh one) and the admin only cares about the current one.
async function attachReturnRefundStatus(supabase: ReturnType<typeof getSupabaseAdmin>, orders: any[]) {
  const orderIds = orders.map((o) => o.id).filter(Boolean);
  if (orderIds.length === 0) return orders;

  const { data: returns, error } = await supabase
    .from('returns')
    .select('order_id, status, refund_status, created_at')
    .in('order_id', orderIds)
    .order('created_at', { ascending: false });
  if (error || !returns || returns.length === 0) return orders;

  const latestByOrderId = new Map<string, { status: string; refund_status: string | null }>();
  for (const r of returns) {
    // Already ordered newest-first, so the first one seen per order_id wins.
    if (!latestByOrderId.has(r.order_id)) {
      latestByOrderId.set(r.order_id, { status: r.status, refund_status: r.refund_status ?? null });
    }
  }

  return orders.map((order) => {
    const match = latestByOrderId.get(order.id);
    return match ? { ...order, _return_status: match.status, _return_refund_status: match.refund_status } : order;
  });
}

export async function fetchOrders() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  const withSources = await attachItemSources(supabase, data ?? []);
  return attachReturnRefundStatus(supabase, withSources);
}

// Called from Admin -> Orders whenever the admin changes an order's status
// (the dropdown in the orders table, or the order detail view). Besides
// writing the new status, this sends the customer a "your order status
// changed" email (best-effort -- a failed/unconfigured email provider
// never blocks the status update itself). The order_status_history table
// is populated separately by a DB trigger, so this function doesn't need
// to touch that.
export async function updateOrderStatus(id: string, status: string) {
  const supabase = getSupabaseAdmin();

  // Fetch first so we know the customer's email + previous status. Also
  // lets us skip the email entirely if the status isn't actually changing
  // (e.g. the admin re-selects the same value).
  const { data: existing, error: fetchError } = await supabase
    .from('orders')
    .select('id, status, customer_email, customer_name, tracking_number, courier_name, items, total_amount')
    .eq('id', id)
    .maybeSingle();
  if (fetchError) throw fetchError;

  const { data, error } = await supabase.from('orders').update({ status }).eq('id', id);
  if (error) throw error;

  if (existing && existing.status !== status && existing.customer_email) {
    // Same gating as verify-payment: only orders from Admin > "Request
    // Online Payment" get the made/kept-ready-on-demand apology copy when
    // moved to 'paid' -- e.g. an admin marking a COD/manually-confirmed
    // order as paid shouldn't send that line either.
    const isPaymentRequestFlow = status === 'paid' ? await isInPaymentRequestFlow(existing.id).catch(() => false) : false;
    const { subject, html } = orderStatusUpdateEmail({
      id: existing.id,
      customer_name: existing.customer_name,
      status,
      tracking_number: existing.tracking_number,
      courier_name: existing.courier_name,
      items: existing.items,
      total_amount: existing.total_amount,
      isPaymentRequestFlow,
    });
    // Best-effort -- never let a slow/broken email provider fail the
    // admin's status update.
    sendEmail({ to: existing.customer_email, subject, html }).catch((err) => {
      console.error('[updateOrderStatus] status-change email failed:', err);
    });
  }

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
