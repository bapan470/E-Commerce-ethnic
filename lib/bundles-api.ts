import { supabase } from './supabase';
import { Product, ProductRow } from './types';
import { mapRowToProduct } from './products-api';

// ---------------------------------------------------------------------
// Phase 13 — "Frequently Bought Together" / "Complete the Look"
// Admin curates explicit pairs in product_bundles (Admin > Marketing >
// Bundles). If a product has no curated bundle yet, the storefront
// falls back to /api/bundles/auto which computes real co-purchase pairs
// from order_items — so the feature still shows something useful on
// day one, before the admin has set anything up manually.
// ---------------------------------------------------------------------

export interface ProductBundleRow {
  id: string;
  product_id: string;
  bundle_product_id: string;
  position: number;
  created_at?: string;
}

// ---- Admin management ----

export async function fetchBundlesForProduct(productId: string): Promise<ProductBundleRow[]> {
  const { data, error } = await supabase
    .from('product_bundles')
    .select('*')
    .eq('product_id', productId)
    .order('position', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProductBundleRow[];
}

export async function addBundleLink(productId: string, bundleProductId: string, position = 0) {
  const { error } = await supabase
    .from('product_bundles')
    .insert({ product_id: productId, bundle_product_id: bundleProductId, position });
  if (error) throw error;
}

export async function removeBundleLink(id: string) {
  const { error } = await supabase.from('product_bundles').delete().eq('id', id);
  if (error) throw error;
}

// ---- Storefront: manual bundle first, auto co-purchase fallback ----

export async function fetchProductBundle(productId: string): Promise<Product[]> {
  const { data: manual, error } = await supabase
    .from('product_bundles')
    .select('position, products:bundle_product_id(*)')
    .eq('product_id', productId)
    .order('position', { ascending: true })
    .limit(4);

  if (!error && manual && manual.length > 0) {
    return manual
      .map((row: any) => (row.products ? mapRowToProduct(row.products as ProductRow) : null))
      .filter(Boolean) as Product[];
  }

  // No manual curation yet — ask the server to compute real co-purchase pairs.
  try {
    const res = await fetch(`/api/bundles/auto?productId=${productId}`);
    if (!res.ok) return [];
    const body = await res.json();
    return (body.products ?? []) as Product[];
  } catch {
    return [];
  }
}
