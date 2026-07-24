import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { getServerSupabase } from '@/lib/supabase-server';

/**
 * GET /api/admin/product-social-status
 *
 * Returns { statusById: { [product_id]: string | null } } — the
 * `social_posted_at` timestamp (or null if never auto/manually posted) for
 * every live product. Used by the Manage Products catalog to decide
 * whether to show a "Share to Social" button or a "✓ Posted" state (with a
 * guarded "Share again" option) per row.
 */
export async function GET() {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const verified = await verifyAdminToken(cookie);
  if (!verified.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('products')
      .select('id, social_posted_at')
      .eq('approval_status', 'live');
    if (error) throw error;

    const statusById: Record<string, string | null> = {};
    for (const row of data ?? []) {
      statusById[row.id] = row.social_posted_at ?? null;
    }

    return NextResponse.json({ statusById });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load social status';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
