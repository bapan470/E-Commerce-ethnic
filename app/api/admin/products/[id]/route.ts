import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// SECURITY: see app/api/admin/products/route.ts for the full writeup.

async function requireAdmin() {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const verified = await verifyAdminToken(cookie);
  return verified.valid;
}

const UPDATABLE_FIELDS = [
  'name', 'slug', 'description', 'price', 'mrp', 'category_id',
  'category_name', 'fabric', 'origin', 'colors', 'sizes', 'occasion', 'images',
  'video_url', 'gender', 'age_group', 'material', 'pattern', 'sku', 'highlights',
  'stock_quantity', 'low_stock_threshold', 'rating', 'reviews', 'featured', 'in_stock',
] as const;

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const input = await req.json().catch(() => ({}));
  const payload: Record<string, unknown> = {};
  for (const key of UPDATABLE_FIELDS) {
    if (input[key] !== undefined) {
      payload[key] = input[key];
    }
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('products')
    .update(payload)
    .eq('id', params.id)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ product: data });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('products').delete().eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
