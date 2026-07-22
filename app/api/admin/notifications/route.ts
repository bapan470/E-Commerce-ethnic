import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { getServerSupabase } from '@/lib/supabase-server';

// Aggregates "needs attention" events from across the admin panel (new
// orders, contact messages, support tickets, return requests, restock
// requests, abandoned carts) into a single feed for the top-right
// notification bell. The client polls this endpoint every ~20s and diffs
// against a locally-stored "last seen" timestamp to figure out the unread
// count, so nothing here needs a dedicated read/unread column.
export type AdminNotification = {
  id: string;
  type: 'order' | 'contact_message' | 'support_ticket' | 'return' | 'restock' | 'abandoned_cart' | 'vendor_pickup';
  title: string;
  message: string;
  section: string;
  created_at: string;
};

export async function GET() {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const verified = await verifyAdminToken(cookie);
  if (!verified.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();

  try {
    const [ordersRes, contactRes, ticketsRes, returnsRes, restockRes, cartsRes, pickupRes] = await Promise.all([
      supabase
        .from('orders')
        .select('id, customer_name, customer_email, total_amount, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('contact_messages')
        .select('id, name, subject, created_at')
        .eq('status', 'new')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('support_tickets')
        .select('id, customer_name, customer_email, subject, created_at')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('returns')
        .select('id, type, reason, created_at')
        .eq('status', 'requested')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('stock_notifications')
        .select('id, email, created_at, products(name)')
        .eq('notified', false)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('abandoned_carts')
        .select('id, email, cart_value, last_activity_at')
        .eq('recovered', false)
        .order('last_activity_at', { ascending: false })
        .limit(10),
      // Phase 3B — vendor tapped "Request Pickup". Stays a task until the
      // item moves past vendor_accepted (i.e. courier actually picked it
      // up), same filter the vendor's own dashboard uses to show/hide the
      // upload-handoff-photo step.
      supabase
        .from('order_items')
        .select('id, product_name, quantity, pickup_requested_at, vendors(business_name, pickup_address)')
        .eq('stage', 'vendor_accepted')
        .not('pickup_requested_at', 'is', null)
        .order('pickup_requested_at', { ascending: false })
        .limit(20),
    ]);

    const notifications: AdminNotification[] = [];

    (ordersRes.data || []).forEach((o: any) => {
      notifications.push({
        id: `order-${o.id}`,
        type: 'order',
        title: 'New order received',
        message: `${o.customer_name || o.customer_email || 'A customer'} placed an order for ₹${o.total_amount}`,
        section: 'orders',
        created_at: o.created_at,
      });
    });

    (contactRes.data || []).forEach((m: any) => {
      notifications.push({
        id: `contact-${m.id}`,
        type: 'contact_message',
        title: 'New contact message',
        message: `${m.name} — ${m.subject}`,
        section: 'contact-messages',
        created_at: m.created_at,
      });
    });

    (ticketsRes.data || []).forEach((t: any) => {
      notifications.push({
        id: `ticket-${t.id}`,
        type: 'support_ticket',
        title: 'Support ticket opened',
        message: `${t.customer_name || t.customer_email} — ${t.subject}`,
        section: 'support-tickets',
        created_at: t.created_at,
      });
    });

    (returnsRes.data || []).forEach((r: any) => {
      notifications.push({
        id: `return-${r.id}`,
        type: 'return',
        title: r.type === 'exchange' ? 'New exchange request' : 'New return request',
        message: r.reason,
        section: 'returns',
        created_at: r.created_at,
      });
    });

    (restockRes.data || []).forEach((s: any) => {
      notifications.push({
        id: `restock-${s.id}`,
        type: 'restock',
        title: 'Restock request',
        message: `${s.email} wants "${s.products?.name || 'a product'}" back in stock`,
        section: 'restock-alerts',
        created_at: s.created_at,
      });
    });

    (cartsRes.data || []).forEach((c: any) => {
      notifications.push({
        id: `cart-${c.id}`,
        type: 'abandoned_cart',
        title: 'Cart abandoned',
        message: `${c.email || 'A shopper'} left ₹${c.cart_value} in their cart`,
        section: 'abandoned-carts',
        created_at: c.last_activity_at,
      });
    });

    (pickupRes.data || []).forEach((p: any) => {
      notifications.push({
        id: `pickup-${p.id}`,
        type: 'vendor_pickup',
        title: 'Vendor requested pickup',
        message: `Book pickup for "${p.product_name}" (qty ${p.quantity}) — ${p.vendors?.business_name || 'vendor'} at ${p.vendors?.pickup_address || 'address on file'}`,
        section: 'vendors',
        created_at: p.pickup_requested_at,
      });
    });

    notifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ notifications: notifications.slice(0, 50) });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 });
  }
}
