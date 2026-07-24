import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { publishProductToSocial } from '@/lib/social-publish-api';

/**
 * POST /api/social/publish  { productId: string }
 *
 * Fire-and-forget endpoint called right after Admin > Products > "Add
 * Product" successfully inserts a new product (see
 * components/admin/products-panel.tsx). Posts the product to
 * Facebook/Instagram per Admin > Marketing > Social Auto-Post settings.
 *
 * Kept as its own tiny route (rather than folding into the client-side
 * createProduct() insert) because the Meta access token must stay
 * server-only — it's never sent to the browser.
 *
 * The vendor-listing path does NOT use this route; it's handled inline in
 * app/api/vendor/ai-process/[id]/route.ts and lib/cron-jobs.ts, right
 * after AI processing finishes, using the same publishProductToSocial().
 */
export async function POST(req: Request) {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const verified = await verifyAdminToken(cookie);
  if (!verified.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { productId } = await req.json().catch(() => ({ productId: null }));
  if (!productId) {
    return NextResponse.json({ error: 'productId required' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const { data: product, error } = await admin
    .from('products')
    .select('id, name, slug, description, price, images, social_posted_at')
    .eq('id', productId)
    .maybeSingle();

  if (error || !product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  try {
    await publishProductToSocial(admin, product);
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Non-fatal from the caller's point of view — the product is already
    // live either way. Log server-side for debugging.
    console.error('[api/social/publish] failed for', productId, err);
    return NextResponse.json({ ok: false, error: 'Social post failed, see server logs' }, { status: 200 });
  }
}
