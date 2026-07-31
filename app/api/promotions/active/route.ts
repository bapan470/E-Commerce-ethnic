import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// GET — public, unauthenticated. Returns every currently-active BOGO
// promotion (is_active = true and within its start/end window), each with
// a resolved `product_ids` array when scope = 'collection'.
//
// This has to go through the service-role client (not a direct client-side
// supabase.from() call) because `collection_products` has no RLS policy for
// `anon` — same reason /api/collection/[slug] resolves collection membership
// server-side instead of letting the browser query it directly. The cart
// (lib/cart-context.tsx) calls this route via fetchActivePromotions() in
// lib/promotions-api.ts so it never needs direct table access.
export async function GET() {
  const supabase = getSupabaseAdmin();

  try {
    const nowIso = new Date().toISOString();

    const { data: promotions, error } = await supabase
      .from('promotions')
      .select('*')
      .eq('is_active', true)
      .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
      .or(`ends_at.is.null,ends_at.gte.${nowIso}`);
    if (error) throw error;

    const active = promotions ?? [];
    const collectionScoped = active.filter((p) => p.scope === 'collection' && p.collection_id);

    let productIdsByCollection = new Map<string, string[]>();
    if (collectionScoped.length > 0) {
      const collectionIds = Array.from(new Set(collectionScoped.map((p) => p.collection_id)));
      const { data: links, error: linksErr } = await supabase
        .from('collection_products')
        .select('collection_id, product_id')
        .in('collection_id', collectionIds);
      if (linksErr) throw linksErr;

      for (const link of links ?? []) {
        const list = productIdsByCollection.get(link.collection_id) ?? [];
        list.push(link.product_id);
        productIdsByCollection.set(link.collection_id, list);
      }
    }

    const result = active.map((promo) => ({
      ...promo,
      product_ids:
        promo.scope === 'collection' && promo.collection_id
          ? productIdsByCollection.get(promo.collection_id) ?? []
          : null,
    }));

    return NextResponse.json({ promotions: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load active promotions';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
