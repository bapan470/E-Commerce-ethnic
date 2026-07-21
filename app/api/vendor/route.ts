import { NextResponse } from 'next/server';
import { getCurrentUser, getSupabaseServer } from '@/lib/supabase-server-auth';

// GET — the logged-in user's own vendor application/profile (null if
// they haven't applied yet). Uses the RLS-aware auth client so this can
// only ever return the caller's own row (see own_select_vendors policy).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Please log in first' }, { status: 401 });
  }

  const supabase = await getSupabaseServer();

  try {
    const { data: vendor, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;

    return NextResponse.json({ vendor: vendor ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load vendor profile';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST — submit a new /sell-with-us application for the logged-in user.
// RLS (own_insert_vendors) additionally enforces status='pending' and
// no bank fields at insert time, so this can't be abused even if the
// validation below were bypassed.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Please log in first' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const business_name = String(body?.business_name || '').trim();
  const owner_name = String(body?.owner_name || '').trim();
  const phone = String(body?.phone || '').trim();
  const pan_number = String(body?.pan_number || '').trim().toUpperCase();
  const pickup_address = String(body?.pickup_address || '').trim();
  const whatsapp = body?.whatsapp ? String(body.whatsapp).trim() : null;
  const email = body?.email ? String(body.email).trim() : user.email ?? null;
  const gst_number = body?.gst_number ? String(body.gst_number).trim().toUpperCase() : null;
  const expected_category = body?.expected_category ? String(body.expected_category).trim() : null;

  if (!business_name || !owner_name || !phone || !pan_number || !pickup_address) {
    return NextResponse.json(
      { error: 'business_name, owner_name, phone, pan_number and pickup_address are required' },
      { status: 400 }
    );
  }

  const supabase = await getSupabaseServer();

  try {
    const { data: existing } = await supabase
      .from('vendors')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        { error: 'You have already applied. Check your application status on the vendor dashboard.' },
        { status: 409 }
      );
    }

    const { data: created, error } = await supabase
      .from('vendors')
      .insert({
        user_id: user.id,
        business_name,
        owner_name,
        phone,
        whatsapp,
        email,
        pan_number,
        gst_number,
        pickup_address,
        expected_category,
        status: 'pending',
      })
      .select('*')
      .single();
    if (error) throw error;

    return NextResponse.json({ vendor: created });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to submit application';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
