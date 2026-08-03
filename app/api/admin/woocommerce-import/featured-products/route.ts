import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

async function requireAdmin() {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const verified = await verifyAdminToken(cookie);
  return verified.valid;
}

// GET /api/admin/woocommerce-import/featured-products?limit=6
// Returns real, in-stock, image-having products from *this* store — used to
// build the "premium template" campaign emails so every product shown is
// real and clickable (never a fake/placeholder image or link). Featured
// products are returned first; if there aren't enough, it's topped up with
// the latest in-stock products.
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limitParam = Number(req.nextUrl.searchParams.get('limit'));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 12) : 6;

  const supabase = getSupabaseAdmin();
  const columns = 'id, name, slug, price, mrp, images, category_name, featured, in_stock';

  const { data: featured, error: featuredError } = await supabase
    .from('products')
    .select(columns)
    .eq('featured', true)
    .eq('in_stock', true)
    .not('images', 'eq', '{}')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (featuredError) {
    return NextResponse.json({ error: featuredError.message }, { status: 500 });
  }

  let products = featured ?? [];

  if (products.length < limit) {
    const have = new Set(products.map((p) => p.id));
    const { data: fillIn, error: fillError } = await supabase
      .from('products')
      .select(columns)
      .eq('in_stock', true)
      .not('images', 'eq', '{}')
      .order('created_at', { ascending: false })
      .limit(limit * 2); // fetch extra so we still have `limit` after de-duping

    if (fillError) {
      return NextResponse.json({ error: fillError.message }, { status: 500 });
    }

    for (const p of fillIn ?? []) {
      if (products.length >= limit) break;
      if (!have.has(p.id)) {
        products.push(p);
        have.add(p.id);
      }
    }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
  const result = products.slice(0, limit).map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: p.price,
    mrp: p.mrp,
    image: p.images?.[0] || null,
    category_name: p.category_name,
    url: `${siteUrl}/product/${p.slug}`,
  }));

  return NextResponse.json({ products: result });
}
