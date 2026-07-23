import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * GET /api/collections
 *
 * Public, unauthenticated list of admin-curated collections for the
 * storefront (Shop by Collection on the homepage). Unlike
 * /api/admin/collections (which requires an admin session and returns
 * every collection, active or not, empty or not), this only returns
 * collections that are:
 *   - is_active = true
 *   - have at least one *live* product in them
 * so the homepage never shows an empty or draft collection tile.
 * Each collection also gets a `thumbnail` — the first image of its
 * first live product — used as the tile photo, same idea as the
 * per-category thumbnail already used for "Shop by Category".
 */
export async function GET() {
  const admin = getSupabaseAdmin();

  try {
    const { data: collections, error } = await admin
      .from('collections')
      .select('id, name, slug, description, is_active, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (error) throw error;

    if (!collections || collections.length === 0) {
      return NextResponse.json({ collections: [] });
    }

    const { data: links, error: linksErr } = await admin
      .from('collection_products')
      .select('collection_id, product_id, position')
      .in('collection_id', collections.map((c) => c.id))
      .order('position', { ascending: true });
    if (linksErr) throw linksErr;

    const productIdsByCollection = new Map<string, string[]>();
    const allProductIds = new Set<string>();
    for (const link of links ?? []) {
      const list = productIdsByCollection.get(link.collection_id) ?? [];
      list.push(link.product_id);
      productIdsByCollection.set(link.collection_id, list);
      allProductIds.add(link.product_id);
    }

    // Only keep products that are actually live — a collection whose
    // products have all since been unpublished should behave the same
    // as an empty collection (i.e. hidden), not show a broken tile.
    const liveImageByProduct = new Map<string, string | undefined>();
    if (allProductIds.size > 0) {
      const { data: liveProducts, error: productsErr } = await admin
        .from('products')
        .select('id, images')
        .in('id', Array.from(allProductIds))
        .eq('approval_status', 'live');
      if (productsErr) throw productsErr;
      for (const p of liveProducts ?? []) {
        liveImageByProduct.set(p.id, (p.images ?? [])[0]);
      }
    }

    const result = collections
      .map((c) => {
        const productIds = productIdsByCollection.get(c.id) ?? [];
        const liveProductIds = productIds.filter((id) => liveImageByProduct.has(id));
        const thumbnail = liveProductIds.map((id) => liveImageByProduct.get(id)).find(Boolean);
        return {
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          product_count: liveProductIds.length,
          thumbnail: thumbnail ?? null,
        };
      })
      // Never show a collection with zero live products on the storefront.
      .filter((c) => c.product_count > 0);

    return NextResponse.json({ collections: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load collections';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
