import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

async function requireAdmin() {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const verified = await verifyAdminToken(cookie);
  return verified.valid;
}

// GET — list all promotions (admin panel table)
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  try {
    const { data, error } = await supabase
      .from('promotions')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ promotions: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load promotions';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST — create a new promotion
export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    name,
    offer_type,
    buy_qty,
    get_qty,
    free_item_discount_percent,
    scope,
    collection_id,
    is_active,
    starts_at,
    ends_at,
  } = body || {};

  if (!name || !String(name).trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (!buy_qty || buy_qty < 1 || !get_qty || get_qty < 1) {
    return NextResponse.json({ error: 'buy_qty and get_qty must be at least 1' }, { status: 400 });
  }
  if (scope === 'collection' && !collection_id) {
    return NextResponse.json(
      { error: 'collection_id is required when scope is "collection"' },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  try {
    const { error } = await supabase.from('promotions').insert({
      name: String(name).trim(),
      offer_type: offer_type || 'buy_x_get_y',
      buy_qty,
      get_qty,
      free_item_discount_percent: free_item_discount_percent ?? 100,
      scope: scope || 'all',
      collection_id: scope === 'collection' ? collection_id : null,
      is_active: is_active ?? true,
      starts_at: starts_at ?? null,
      ends_at: ends_at ?? null,
    });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create promotion';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
