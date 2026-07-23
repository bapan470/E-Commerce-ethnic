import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { mapRowToProduct, CUSTOMER_SAFE_PRODUCT_COLUMNS } from '@/lib/products-api-server';
import { ProductRow } from '@/lib/types';

/**
 * GET /api/collection/[slug]
 *
 * Public collection page for one vendor: /collection/[slug] renders
 * this. Reads only from `vendor_public_profiles` (approved vendors,
 * safe columns only -- see the storefront migration) plus each of the
 * vendor's live products.
 *
 * The aggregate rating/review count is computed from the live
 * `reviews` table (approved reviews only), the same source the
 * single-product page uses -- NOT from the `products.rating` /
 * `products.reviews` columns, which are just admin-set seed numbers
 * shown before a product has any real reviews and otherwise go stale.
 * For a product with at least one live approved review, its live
 * average/count is used; for a product with none yet, its seed
 * rating/reviews are used instead (same "seed until real reviews
 * exist" rule as the product page) so freshly-seeded products still
 * contribute. The result is only included in the response when the
 * vendor's `show_public_rating` toggle (Admin > Vendors) is on --
 * when it's off, `rating`/`reviewCount` come back null and the page
 * shows the plain product listing with no rating summary block.
 */
export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const admin = getSupabaseAdmin();

  try {
    const { data: vendor, error: vendorErr } = await admin
      .from('vendor_public_profiles')
      .select('id, business_name, storefront_slug, show_public_rating, created_at')
      .eq('storefront_slug', params.slug)
      .maybeSingle();

    if (vendorErr || !vendor) {
      return NextResponse.json({ vendor: null }, { status: 404 });
    }

    const { data: rows, error: rowsErr } = await admin
      .from('products')
      .select(CUSTOMER_SAFE_PRODUCT_COLUMNS)
      .eq('vendor_id', vendor.id)
      .eq('approval_status', 'live')
      .order('created_at', { ascending: false });

    if (rowsErr) throw rowsErr;

    const productRows = (rows ?? []) as unknown as ProductRow[];
    const products = productRows.map(mapRowToProduct);

    let rating: number | null = null;
    let reviewCount: number | null = null;
    if (vendor.show_public_rating && productRows.length > 0) {
      const productIds = productRows.map((p) => p.id);
      const { data: liveReviews, error: reviewsErr } = await admin
        .from('reviews')
        .select('product_id, rating')
        .in('product_id', productIds)
        .eq('is_approved', true);

      if (reviewsErr) throw reviewsErr;

      // Group live approved reviews by product.
      const liveByProduct = new Map<string, { count: number; sum: number }>();
      for (const r of liveReviews ?? []) {
        const entry = liveByProduct.get(r.product_id) ?? { count: 0, sum: 0 };
        entry.count += 1;
        entry.sum += Number(r.rating) || 0;
        liveByProduct.set(r.product_id, entry);
      }

      // Per product: prefer its live approved reviews; fall back to the
      // admin-set seed rating/reviews only when it has none yet.
      let totalCount = 0;
      let weightedSum = 0;
      for (const p of productRows) {
        const live = liveByProduct.get(p.id);
        if (live && live.count > 0) {
          totalCount += live.count;
          weightedSum += live.sum;
        } else if ((p.reviews ?? 0) > 0) {
          totalCount += p.reviews ?? 0;
          weightedSum += (p.rating ?? 0) * (p.reviews ?? 0);
        }
      }

      reviewCount = totalCount;
      rating = totalCount > 0 ? weightedSum / totalCount : null;
    }

    return NextResponse.json({
      vendor: {
        id: vendor.id,
        name: vendor.business_name,
        slug: vendor.storefront_slug,
        since: vendor.created_at,
      },
      showRating: vendor.show_public_rating,
      rating,
      reviewCount,
      products,
    });
  } catch (err) {
    console.error('[collection]', params.slug, 'failed', err);
    return NextResponse.json({ vendor: null }, { status: 500 });
  }
}
