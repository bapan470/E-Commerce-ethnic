import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

async function requireAdmin() {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const verified = await verifyAdminToken(cookie);
  return verified.valid;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

// GET — every admin-managed collection, newest first, with a product count
// per collection (used by the Collections panel list + search + filter).
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();

  try {
    const { data: collections, error } = await admin
      .from('collections')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const { data: counts, error: countsErr } = await admin
      .from('collection_products')
      .select('collection_id');
    if (countsErr) throw countsErr;

    const countByCollection = new Map<string, number>();
    for (const row of counts ?? []) {
      countByCollection.set(row.collection_id, (countByCollection.get(row.collection_id) ?? 0) + 1);
    }

    const result = (collections ?? []).map((c) => ({
      ...c,
      product_count: countByCollection.get(c.id) ?? 0,
    }));

    return NextResponse.json({ collections: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load collections';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST — create a new collection. Only admin can create these (unlike
// vendor collections, which are auto-derived per approved vendor).
export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const description = typeof body?.description === 'string' ? body.description.trim() || null : null;
  const is_active = typeof body?.is_active === 'boolean' ? body.is_active : true;
  const requestedSlug = typeof body?.slug === 'string' ? body.slug.trim() : '';
  const productIds: string[] = Array.isArray(body?.product_ids)
    ? body.product_ids.filter((id: unknown) => typeof id === 'string')
    : [];

  if (!name) {
    return NextResponse.json({ error: 'Collection name is required' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const baseSlug = slugify(requestedSlug || name) || 'collection';

  try {
    // Guarantee a unique slug even if the requested one collides with an
    // existing collection, or with a vendor's storefront slug (both share
    // the /collection/[slug] URL space).
    let slug = baseSlug;
    let suffix = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const [{ data: collisionCollection }, { data: collisionVendor }] = await Promise.all([
        admin.from('collections').select('id').eq('slug', slug).maybeSingle(),
        admin.from('vendors').select('id').eq('storefront_slug', slug).maybeSingle(),
      ]);
      if (!collisionCollection && !collisionVendor) break;
      suffix += 1;
      slug = `${baseSlug}-${suffix}`;
    }

    const { data: collection, error } = await admin
      .from('collections')
      .insert({ name, slug, description, is_active })
      .select('*')
      .single();
    if (error) throw error;

    if (productIds.length > 0) {
      const rows = productIds.map((product_id, idx) => ({
        collection_id: collection.id,
        product_id,
        position: idx,
      }));
      const { error: linkErr } = await admin.from('collection_products').insert(rows);
      if (linkErr) throw linkErr;
    }

    return NextResponse.json({ success: true, collection: { ...collection, product_count: productIds.length } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create collection';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
