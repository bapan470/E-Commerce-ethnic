'use client';

import { supabase } from './supabase';

export interface StockNotificationRow {
  id: string;
  product_id: string;
  email: string;
  notified: boolean;
  notified_at: string | null;
  created_at: string;
  products?: { name: string; slug: string; in_stock: boolean } | null;
}

/** Called from the storefront "Notify me" form on an out-of-stock product. */
export async function requestStockNotification(productId: string, email: string) {
  const { error } = await supabase
    .from('stock_notifications')
    .upsert(
      { product_id: productId, email: email.trim().toLowerCase(), notified: false, notified_at: null },
      { onConflict: 'product_id,email' }
    );
  if (error) throw error;
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
