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
  const { data, error } = await supabase
    .from('stock_notifications')
    .select('*, products(name, slug, in_stock)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as StockNotificationRow[];
}

export async function deleteStockNotification(id: string): Promise<void> {
  const { error } = await supabase.from('stock_notifications').delete().eq('id', id);
  if (error) throw error;
}
