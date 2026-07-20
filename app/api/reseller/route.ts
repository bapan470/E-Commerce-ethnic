import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/supabase-server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

// GET — the logged-in customer's reseller profile (null if they haven't
// joined yet) plus a small earnings summary computed from their orders.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Please log in first' }, { status: 401 });
  }

  const supabase = getServerSupabase();

  try {
    const { data: profile, error: profileErr } = await supabase
      .from('reseller_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (profileErr) throw profileErr;

    if (!profile) {
      return NextResponse.json({
        profile: null,
        earnings: { totalOrders: 0, totalSales: 0, totalProfit: 0, pendingOrders: 0 },
      });
    }

    const { data: orders, error: ordersErr } = await supabase
      .from('orders')
      .select('total_amount, reseller_profit, status')
      .eq('reseller_id', profile.id);
    if (ordersErr) throw ordersErr;

    const totalOrders = orders?.length ?? 0;
    const totalSales = (orders ?? []).reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const totalProfit = (orders ?? []).reduce((sum, o) => sum + (o.reseller_profit || 0), 0);
    const pendingOrders = (orders ?? []).filter((o) => !['delivered', 'cancelled', 'failed'].includes(o.status)).length;

    return NextResponse.json({
      profile,
      earnings: { totalOrders, totalSales, totalProfit, pendingOrders },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load reseller data';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST — join the reseller program using the SAME logged-in account
// (no new email/signup required).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Please log in first' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const markupRaw = Number(body?.default_markup_amount);
  const default_markup_amount = Number.isFinite(markupRaw) ? Math.max(markupRaw, 0) : 100;

  const supabase = getServerSupabase();

  try {
    const { data: existing } = await supabase
      .from('reseller_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ profile: existing });
    }

    const { data: created, error } = await supabase
      .from('reseller_profiles')
      .insert({ user_id: user.id, default_markup_amount, status: 'active' })
      .select('*')
      .single();
    if (error) throw error;

    return NextResponse.json({ profile: created });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to join reseller program';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT — update the reseller's default margin %.
export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Please log in first' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const markupRaw = Number(body?.default_markup_amount);
  if (!Number.isFinite(markupRaw) || markupRaw < 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
  }
  const default_markup_amount = markupRaw;

  const supabase = getServerSupabase();

  try {
    const { error } = await supabase
      .from('reseller_profiles')
      .update({ default_markup_amount, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update default markup';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
