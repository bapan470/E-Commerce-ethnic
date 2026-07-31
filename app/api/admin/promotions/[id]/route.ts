import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

async function requireAdmin() {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const verified = await verifyAdminToken(cookie);
  return verified.valid;
}

// PATCH — full edit, or a partial toggle (is_active)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};

  if (body.name !== undefined) update.name = String(body.name).trim();
  if (body.offer_type !== undefined) update.offer_type = body.offer_type;
  if (body.buy_qty !== undefined) update.buy_qty = body.buy_qty;
  if (body.get_qty !== undefined) update.get_qty = body.get_qty;
  if (body.free_item_discount_percent !== undefined) {
    update.free_item_discount_percent = body.free_item_discount_percent;
  }
  if (body.scope !== undefined) update.scope = body.scope;
  if (body.collection_id !== undefined) {
    update.collection_id = body.scope === 'collection' || body.scope === undefined
      ? body.collection_id
      : null;
  }
  if (body.is_active !== undefined) update.is_active = body.is_active;
  if (body.starts_at !== undefined) update.starts_at = body.starts_at;
  if (body.ends_at !== undefined) update.ends_at = body.ends_at;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  try {
    const { error } = await supabase.from('promotions').update(update).eq('id', params.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update promotion';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  try {
    const { error } = await supabase.from('promotions').delete().eq('id', params.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete promotion';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
