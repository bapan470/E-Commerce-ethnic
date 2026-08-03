import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// SECURITY: this route touches another store's WooCommerce Consumer
// Key/Secret and writes personal data (email/phone) into our DB. It must
// only ever run server-side, gated by the admin session cookie -- never
// call the WooCommerce API or the woocommerce_customers table from a
// client component directly.

async function requireAdmin() {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const verified = await verifyAdminToken(cookie);
  return verified.valid;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const supabase = getSupabaseAdmin();
  try {
    const { data, error } = await supabase
      .from('woocommerce_customers')
      .select('*')
      .order('imported_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ customers: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load customers';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type WooOrder = {
  id: number;
  billing?: { first_name?: string; last_name?: string; email?: string; phone?: string };
  customer_id?: number;
  date_created?: string;
};

function normalizeUrl(url: string) {
  return url.trim().replace(/\/+$/, '');
}

async function wooFetch(path: string, creds: { storeUrl: string; consumerKey: string; consumerSecret: string }) {
  const base = normalizeUrl(creds.storeUrl);
  const url = `${base}${path}`;

  // Use HTTP Basic Auth (recommended by WooCommerce for HTTPS stores) instead
  // of ?consumer_key=&consumer_secret= in the query string -- some
  // Cloudflare / WAF rules flag secrets-in-the-URL as suspicious and block
  // the request with a "Just a moment..." challenge page before it ever
  // reaches WordPress. A normal browser-like User-Agent avoids the same
  // bot-protection filters that a bare server-to-server request would trip.
  const basicAuth = Buffer.from(`${creds.consumerKey}:${creds.consumerSecret}`).toString('base64');

  const res = await fetch(url, {
    headers: {
      Authorization: `Basic ${basicAuth}`,
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const isCloudflareChallenge = body.includes('Just a moment') || body.includes('cf-browser-verification');
    if (isCloudflareChallenge) {
      throw new Error(
        `Cloudflare ne is request ko block kar diya (site "${base}" Cloudflare ke peeche hai). ` +
          `Cloudflare dashboard me /wp-json/wc/* path ke liye Bot Fight Mode/WAF me exception banani hogi.`
      );
    }
    throw new Error(`WooCommerce API error (${res.status}): ${body.slice(0, 300) || res.statusText}`);
  }
  return res.json();
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { storeUrl?: string; consumerKey?: string; consumerSecret?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const storeUrl = body.storeUrl?.trim();
  const consumerKey = body.consumerKey?.trim();
  const consumerSecret = body.consumerSecret?.trim();

  if (!storeUrl || !consumerKey || !consumerSecret) {
    return NextResponse.json(
      { error: 'storeUrl, consumerKey and consumerSecret are all required' },
      { status: 400 }
    );
  }

  const creds = { storeUrl, consumerKey, consumerSecret };
  const supabase = getSupabaseAdmin();

  // Only pull from REAL orders -- never from /wp-json/wc/v3/customers.
  // The customers endpoint returns every *registered* WordPress user with
  // the customer role, which on many stores includes hundreds/thousands of
  // bot spam sign-ups that never bought anything. Building the list from
  // orders instead means every row here is someone who actually checked
  // out -- exactly what the site's own admin "Customers" tab does too.
  //
  // Keyed by email (not order id / customer id), so the same person is
  // never duplicated across pages or across repeated imports.
  const byEmail = new Map<
    string,
    { name: string | null; email: string; phone: string | null; latestOrderId: number }
  >();

  try {
    let page = 1;
    let totalOrdersSeen = 0;
    for (;;) {
      const orders: WooOrder[] = await wooFetch(`/wp-json/wc/v3/orders?per_page=100&page=${page}`, creds);
      if (!Array.isArray(orders) || orders.length === 0) break;
      totalOrdersSeen += orders.length;

      for (const o of orders) {
        const email = (o.billing?.email || '').trim().toLowerCase();
        if (!email) continue;
        const name = [o.billing?.first_name, o.billing?.last_name].filter(Boolean).join(' ').trim() || null;
        const phone = o.billing?.phone?.trim() || null;

        const existing = byEmail.get(email);
        if (existing) {
          // Keep the most complete info seen for this email across all their orders.
          if (!existing.name && name) existing.name = name;
          if (!existing.phone && phone) existing.phone = phone;
        } else {
          byEmail.set(email, { name, email, phone, latestOrderId: o.id });
        }
      }
      if (orders.length < 100) break;
      page += 1;
      if (page > 500) break; // safety cap: 50,000 orders
    }

    const rows = Array.from(byEmail.values()).map((r) => ({
      wc_customer_id: `order:${r.latestOrderId}`,
      name: r.name,
      email: r.email,
      phone: r.phone,
      source: 'woocommerce',
      updated_at: new Date().toISOString(),
    }));

    if (rows.length === 0) {
      return NextResponse.json({ imported: 0, updated: 0, skipped: 0, total: 0, ordersScanned: totalOrdersSeen });
    }

    // Upsert in batches, deduped on email (fixes the "same email twice" bug --
    // re-importing now updates the existing row for that email instead of
    // creating a second one).
    const BATCH = 500;
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      const { error } = await supabase.from('woocommerce_customers').upsert(chunk, { onConflict: 'email' });
      if (error) throw error;
    }

    return NextResponse.json({
      imported: rows.length,
      updated: 0,
      skipped: 0,
      total: rows.length,
      ordersScanned: totalOrdersSeen,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Import failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
