import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// Last 10 digits of a phone number, for loose matching between however a
// number happened to be typed (with/without +91, spaces, a leading 0) in
// the cart-tracking widget vs. the checkout form.
function last10Digits(phone: string | null | undefined): string | null {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

export async function GET() {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const verified = await verifyAdminToken(cookie);
  if (!verified.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  try {
    const { data: carts, error } = await supabase
      .from('abandoned_carts')
      .select('*')
      .order('last_activity_at', { ascending: false })
      .limit(200);
    if (error) throw error;

    // Cross-check every still-open cart against real orders, by email OR
    // phone, so the admin can see up front "this person already ordered"
    // instead of finding out only after sending a recovery email/WhatsApp
    // that turns out to be redundant. This is a safety net on top of the
    // automatic `recovered` flag (set in lib/order-confirmation.ts), which
    // only fires when the order's email matches exactly — it won't catch
    // an order placed with a different email but the same phone number,
    // or any older cart from before that auto-matching existed.
    const openCarts = (carts || []).filter((c) => !c.recovered);
    if (openCarts.length > 0) {
      const emails = Array.from(new Set(openCarts.map((c) => c.email).filter(Boolean)));
      const phoneDigitsList = Array.from(
        new Set(openCarts.map((c) => last10Digits(c.phone)).filter(Boolean))
      );

      const orFilters: string[] = [];
      if (emails.length > 0) {
        orFilters.push(`customer_email.in.(${emails.map((e) => `"${e}"`).join(',')})`);
      }
      for (const digits of phoneDigitsList) {
        orFilters.push(`customer_phone.ilike.%${digits}`);
      }

      if (orFilters.length > 0) {
        const { data: matchingOrders } = await supabase
          .from('orders')
          .select('id, customer_email, customer_phone, status, created_at')
          .neq('status', 'cancelled')
          .or(orFilters.join(','))
          .order('created_at', { ascending: false });

        const byEmail = new Map<string, any>();
        const byPhone = new Map<string, any>();
        for (const o of matchingOrders || []) {
          if (o.customer_email && !byEmail.has(o.customer_email)) byEmail.set(o.customer_email, o);
          const d = last10Digits(o.customer_phone);
          if (d && !byPhone.has(d)) byPhone.set(d, o);
        }

        for (const c of openCarts) {
          const match =
            (c.email && byEmail.get(c.email)) || (c.phone && byPhone.get(last10Digits(c.phone) || '')) || null;
          if (match) {
            (c as any).existing_order = {
              id: match.id,
              status: match.status,
              created_at: match.created_at,
            };
          }
        }
      }
    }

    return NextResponse.json({ carts: carts || [] });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to load abandoned carts' }, { status: 500 });
  }
}
