import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { getServerSupabase } from '@/lib/supabase-server';

/**
 * GET /api/admin/product-variant-counts
 *
 * Returns { counts: { [product_id]: number } } for every product that has
 * at least one colour variant. Used by the Manage Products catalog to show
 * a "3 colours" badge in the list itself, without needing to open the
 * product or its palette/variants dialog.
 */
export async function GET() {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const verified = await verifyAdminToken(cookie);
  if (!verified.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase.from('product_variants').select('product_id');
    if (error) throw error;

    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      counts[row.product_id] = (counts[row.product_id] ?? 0) + 1;
    }

    return NextResponse.json({ counts });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load variant counts';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
