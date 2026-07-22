import { NextResponse } from 'next/server';
import { getCurrentUser, getSupabaseServer } from '@/lib/supabase-server-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { suggestVendorProductPrice } from '@/lib/ai-pricing';

// Fields the VENDOR is ever allowed to see about their own submissions.
// Deliberately excludes vendor_id (redundant — it's their own id anyway)
// and anything that would matter for other vendors. This route is never
// used by customer-facing pages.
const VENDOR_PRODUCT_COLUMNS = [
  'id', 'name', 'slug', 'images', 'fabric', 'category_name',
  'available_quantity', 'vendor_expected_price', 'ai_suggested_price',
  'final_price', 'is_dead_stock', 'approval_status', 'barcode',
  'rejection_reason', 'created_at',
].join(', ');

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

function randomSuffix(len = 5) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// GET — everything the logged-in vendor has ever submitted, newest
// first. RLS (own_select_vendor_products, Phase 2 migration) already
// restricts this to their own rows even without the .eq() below —
// kept explicit for clarity.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Please log in first' }, { status: 401 });
  }

  const supabase = await getSupabaseServer();

  try {
    const { data: vendor, error: vendorErr } = await supabase
      .from('vendors')
      .select('id, status')
      .eq('user_id', user.id)
      .maybeSingle();
    if (vendorErr) throw vendorErr;
    if (!vendor) {
      return NextResponse.json({ error: 'No vendor profile found for this account' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('products')
      .select(VENDOR_PRODUCT_COLUMNS)
      .eq('vendor_id', vendor.id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    return NextResponse.json({ products: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load your products';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST — submit a new product for review.
//
// - approval_status is always forced to 'pending_review' here — never
//   trusted from the request body.
// - barcode is never supplied by the vendor; the Phase 2 migration's
//   trg_products_set_barcode trigger auto-generates it on insert.
// - final_price / ai_suggested_price are left for the admin (Part 5)
//   and the pricing function (Part 4) to fill in — this route never
//   sets them beyond a provisional placeholder equal to what the
//   vendor asked for, which the guard trigger (Phase 2 migration)
//   would in any case block from ever being changed by this vendor
//   later on an UPDATE.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Please log in first' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const name = String(body?.name || '').trim();
  const fabric = String(body?.fabric || '').trim();
  const category_name = String(body?.category_name || '').trim();
  const category_id = body?.category_id ? String(body.category_id) : null;
  const images = Array.isArray(body?.images) ? body.images.filter((u: unknown) => typeof u === 'string' && u) : [];
  const available_quantity = Number(body?.available_quantity);
  const is_dead_stock = Boolean(body?.is_dead_stock);
  const vendor_expected_price =
    body?.vendor_expected_price === '' || body?.vendor_expected_price === null || body?.vendor_expected_price === undefined
      ? null
      : Number(body.vendor_expected_price);

  if (!name || !fabric || !category_name) {
    return NextResponse.json({ error: 'name, fabric and category are required' }, { status: 400 });
  }
  if (images.length === 0) {
    return NextResponse.json({ error: 'At least one product photo is required' }, { status: 400 });
  }
  if (!Number.isFinite(available_quantity) || available_quantity < 0) {
    return NextResponse.json({ error: 'Quantity must be a non-negative number' }, { status: 400 });
  }
  if (vendor_expected_price !== null && (!Number.isFinite(vendor_expected_price) || vendor_expected_price < 0)) {
    return NextResponse.json({ error: 'Expected price must be a non-negative number' }, { status: 400 });
  }

  const supabase = await getSupabaseServer();

  try {
    const { data: vendor, error: vendorErr } = await supabase
      .from('vendors')
      .select('id, status')
      .eq('user_id', user.id)
      .maybeSingle();
    if (vendorErr) throw vendorErr;
    if (!vendor) {
      return NextResponse.json({ error: 'No vendor profile found for this account' }, { status: 403 });
    }
    if (vendor.status !== 'approved') {
      return NextResponse.json(
        { error: 'Only approved vendors can list products. Check your application status.' },
        { status: 403 }
      );
    }

    // Placeholder — never shown to customers (approval_status stays
    // 'pending_review'/'awaiting_stock' until an admin sets the real
    // final_price in Part 5, at which point it's copied into `price`).
    const placeholderPrice = Math.max(0, Math.round(vendor_expected_price ?? 0));

    const insertPayload = {
      name,
      slug: `${slugify(name) || 'product'}-${randomSuffix()}`,
      price: placeholderPrice,
      category_id,
      category_name,
      fabric,
      colors: [],
      sizes: ['Free Size'],
      images,
      gender: 'female',
      age_group: 'adult',
      highlights: {},
      stock_quantity: available_quantity,
      low_stock_threshold: 5,
      rating: 4.5,
      reviews: 0,
      featured: false,
      in_stock: available_quantity > 0,

      vendor_id: vendor.id,
      approval_status: 'pending_review' as const,
      vendor_expected_price,
      available_quantity,
      is_dead_stock,
      final_price: placeholderPrice,
    };

    let { data: created, error } = await supabase
      .from('products')
      .insert(insertPayload)
      .select(VENDOR_PRODUCT_COLUMNS)
      .single();

    // Extremely unlikely slug collision — retry once with a fresh suffix.
    if (error?.code === '23505' && error.message?.includes('slug')) {
      const retry = await supabase
        .from('products')
        .insert({ ...insertPayload, slug: `${slugify(name) || 'product'}-${randomSuffix()}` })
        .select(VENDOR_PRODUCT_COLUMNS)
        .single();
      created = retry.data;
      error = retry.error;
    }
    if (error) throw error;

    // Part 3 — rule-based AI price suggestion, runs right on submit.
    // ai_suggested_price is a guarded column (trg_guard_vendor_product_fields,
    // Phase 2 migration) — only the service-role client can write it, so
    // this PATCH deliberately goes through getSupabaseAdmin(), not the
    // RLS-authenticated `supabase` client used above. A failure here
    // must never fail the submission itself: the vendor's product is
    // already saved and pending review either way, so this is best-effort
    // and only logs on error.
    if (created) {
      const { suggested_price } = await suggestVendorProductPrice(getSupabaseAdmin(), {
        category_name,
        fabric,
        vendor_expected_price,
        is_dead_stock,
      });

      if (suggested_price != null) {
        const { data: patched, error: patchErr } = await getSupabaseAdmin()
          .from('products')
          .update({ ai_suggested_price: suggested_price })
          .eq('id', (created as any)?.id)
          .select(VENDOR_PRODUCT_COLUMNS)
          .single();

        if (patchErr) {
          console.error('[vendor/products] failed to save ai_suggested_price:', patchErr);
        } else if (patched) {
          created = patched;
        }
      }
    }

    return NextResponse.json({ product: created });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to submit product';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
