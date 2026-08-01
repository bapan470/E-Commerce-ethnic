import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

async function requireAdmin() {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const verified = await verifyAdminToken(cookie);
  return verified.valid;
}

// GET — list all hero banners (admin panel table)
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  try {
    const { data, error } = await supabase
      .from('hero_banners')
      .select('*')
      .order('position', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ banners: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load hero banners';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST — create a new hero banner
export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { position, image_url, link_url, is_active } = body || {};

  if (!image_url || !String(image_url).trim()) {
    return NextResponse.json({ error: 'image_url is required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  try {
    // New banners default to the end of the list unless a position is given.
    let nextPosition = position;
    if (nextPosition === undefined || nextPosition === null) {
      const { data: maxRow } = await supabase
        .from('hero_banners')
        .select('position')
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle();
      nextPosition = (maxRow?.position ?? -1) + 1;
    }

    const { error } = await supabase.from('hero_banners').insert({
      position: nextPosition,
      image_url: String(image_url).trim(),
      link_url: link_url && String(link_url).trim() ? String(link_url).trim() : null,
      is_active: is_active ?? true,
    });
    if (error) throw error;
    revalidatePath('/');
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create hero banner';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
