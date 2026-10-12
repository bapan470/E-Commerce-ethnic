'use client';

export interface StockNotificationRow {
  id: string;
  product_id: string;
  email: string | null;
  phone?: string | null;
  whatsapp_sent?: boolean;
  notified: boolean;
  notified_at: string | null;
  created_at: string;
  products?: { name: string; slug: string; in_stock: boolean } | null;
}

/** Called from the storefront "Notify me" form on an out-of-stock product (email and/or WhatsApp). */
export async function requestStockNotification(
  productId: string,
  contact: { email?: string; phone?: string }
) {
  const res = await fetch('/api/stock-notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product_id: productId, email: contact.email, phone: contact.phone }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Failed to save');
}

/** Admin: list all signups, most recent first, with product name/slug joined in. */
export async function fetchStockNotifications(): Promise<StockNotificationRow[]> {
  // SECURITY: moved server-side — see app/api/admin/stock-notifications/route.ts.
  const res = await fetch('/api/admin/stock-notifications');
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to load notifications');
  return json.notifications as StockNotificationRow[];
}

export async function deleteStockNotification(id: string): Promise<void> {
  // SECURITY: moved server-side — see app/api/admin/stock-notifications/[id]/route.ts.
  const res = await fetch(`/api/admin/stock-notifications/${id}`, { method: 'DELETE' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Failed to delete notification');
}

/** Admin: mark a WhatsApp-only signup as messaged. */
export async function markWhatsappSent(id: string): Promise<void> {
  const res = await fetch(`/api/admin/stock-notifications/${id}`, { method: 'PATCH' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Failed to update');
}
