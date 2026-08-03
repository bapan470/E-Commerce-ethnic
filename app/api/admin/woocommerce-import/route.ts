import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// Give this route as much wall-clock time as the platform allows (Vercel
// Pro/Enterprise honour this up to their plan's cap; Hobby ignores it and
// stays capped at 10s -- which is exactly why the import is now chunked +
// resumable below instead of relying on one call finishing everything).
export const maxDuration = 60;

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
    const message =
      err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Failed to load customers';
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

  let body: { storeUrl?: string; consumerKey?: string; consumerSecret?: string; reset?: boolean };
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
  const reset = body.reset === true;

  // ---- Resume support --------------------------------------------------
  // Fetching every order page from another site (through Cloudflare) is
  // slow, and serverless functions have a hard execution time limit
  // (10-60s depending on host/plan). Doing all 20-30+ pages in one request
  // was silently getting killed mid-way, leaving an incomplete import with
  // no clear error. Instead: process a small chunk of pages per call, save
  // how far we got in the `settings` table, and let the browser call this
  // route again automatically until every page is done.
  const CURSOR_KEY = 'woocommerce_import_cursor';
  // NOTE: this project deploys to Netlify (see netlify.toml), whose default
  // function timeout is well under the 60s "maxDuration" above (that value
  // is a Vercel-only setting and does nothing here). 8 sequential external
  // requests to a Cloudflare-protected store routinely blew past that limit,
  // the function got killed mid-request, and the platform's own timeout
  // page (not JSON) came back -- which is why the browser only ever showed
  // the generic "Import failed" fallback instead of a real reason. Keeping
  // each call to a small handful of pages keeps us safely inside the limit.
  const PAGES_PER_CALL = 3;

  let startPage = 1;
  if (!reset) {
    const { data: cursorRow } = await supabase.from('settings').select('value').eq('key', CURSOR_KEY).maybeSingle();
    const cursor = cursorRow?.value as { storeUrl?: string; page?: number } | undefined;
    if (cursor?.storeUrl === storeUrl && cursor.page) {
      startPage = cursor.page;
    }
  }

  // Only pull from REAL orders -- never from /wp-json/wc/v3/customers.
  // The customers endpoint returns every *registered* WordPress user with
  // the customer role, which on many stores includes hundreds/thousands of
  // bot spam sign-ups that never bought anything. Building the list from
  // orders instead means every row here is someone who actually checked
  // out -- exactly what the site's own admin "Customers" tab does too.
  //
  // Keyed by email (not order id / customer id), so the same person is
  // never duplicated across pages or across repeated/resumed imports.
  const byEmail = new Map<
    string,
    { name: string | null; email: string; phone: string | null; latestOrderId: number }
  >();

  try {
    let page = startPage;
    let pagesThisCall = 0;
    let done = false;
    let ordersScanned = 0;

    while (pagesThisCall < PAGES_PER_CALL) {
      const orders: WooOrder[] = await wooFetch(`/wp-json/wc/v3/orders?per_page=100&page=${page}`, creds);
      pagesThisCall += 1;
      if (!Array.isArray(orders) || orders.length === 0) {
        done = true;
        break;
      }
      ordersScanned += orders.length;

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

      if (orders.length < 100) {
        done = true;
        break;
      }
      page += 1;
      if (page > 1000) {
        done = true; // safety cap: 100,000 orders
        break;
      }
    }

    const rows = Array.from(byEmail.values()).map((r) => ({
      wc_customer_id: `order:${r.latestOrderId}`,
      name: r.name,
      email: r.email,
      phone: r.phone,
      source: 'woocommerce',
      updated_at: new Date().toISOString(),
    }));

    // Upsert whatever we found this call, deduped on email (fixes the
    // "same email twice" bug -- re-importing/resuming updates the existing
    // row for that email instead of creating a second one).
    const BATCH = 500;
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      const { error } = await supabase.from('woocommerce_customers').upsert(chunk, { onConflict: 'email' });
      if (error) throw error;
    }

    if (done) {
      // Import finished -- clear the cursor so the next click starts fresh.
      await supabase.from('settings').delete().eq('key', CURSOR_KEY);
    } else {
      await supabase
        .from('settings')
        .upsert({ key: CURSOR_KEY, value: { storeUrl, page } }, { onConflict: 'key' });
    }

    return NextResponse.json({
      done,
      imported: rows.length,
      ordersScanned,
      nextPage: done ? null : page,
    });
  } catch (err) {
    // Supabase's PostgrestError (and most other thrown error shapes) is a
    // plain object, NOT an instance of the built-in Error class -- so
    // `err instanceof Error` was always false for DB errors and silently
    // fell back to a hardcoded, meaningless "Import failed" string. Pull
    // `.message` off whatever shape we got instead, so the real reason
    // (bad credentials, Cloudflare block, a Postgres constraint error, etc.)
    // actually reaches the admin.
    const message =
      err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Import failed';
    console.error('[woocommerce-import] failed:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
