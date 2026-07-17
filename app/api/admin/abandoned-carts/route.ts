import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { getServerSupabase } from '@/lib/supabase-server';

export async function GET() {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const verified = await verifyAdminToken(cookie);
  if (!verified.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();

  try {
    const { data: carts, error } = await supabase
      .from('abandoned_carts')
      .select('*')
      .order('last_activity_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    return NextResponse.json({ carts: carts || [] });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to load abandoned carts' }, { status: 500 });
  }
}
