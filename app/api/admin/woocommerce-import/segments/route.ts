import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

async function requireAdmin() {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const verified = await verifyAdminToken(cookie);
  return verified.valid;
}

export type AudienceSegment = 'cold' | 'warm' | 'hot';

// GET /api/admin/woocommerce-import/segments
//
// Classifies every non-opted-out imported customer into:
//   HOT  - clicked into an email AND (bought something afterwards, or
//          visited more than one page on that visit)
//   WARM - clicked into an email (landed on the site) but didn't buy and
//          only looked at one page
//   COLD - never opened any campaign email, or opened but never clicked
//
// Returns a flat { customerId: segment } map (the panel already has the
// full customer list loaded, so it just needs the label per id) plus
// bucket counts for the summary chips.
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const { data: customers, error: custErr } = await supabase
    .from('woocommerce_customers')
    .select('id')
    .eq('opted_out', false)
    .limit(20000);
  if (custErr) return NextResponse.json({ error: custErr.message }, { status: 500 });

  const allIds = (customers ?? []).map((c) => c.id);
  const segments: Record<string, AudienceSegment> = {};
  for (const id of allIds) segments[id] = 'cold'; // default: nothing has happened yet

  if (allIds.length === 0) {
    return NextResponse.json({ segments, counts: { cold: 0, warm: 0, hot: 0, total: 0 } });
  }

  // Every send this batch of customers has ever received, in chunks (the
  // customer list can run into the thousands and `.in()` has a practical
  // URL-length limit).
  const CHUNK = 400;
  const sendRows: { id: string; customer_id: string; clicked_at: string | null }[] = [];
  for (let i = 0; i < allIds.length; i += CHUNK) {
    const slice = allIds.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('woocommerce_campaign_sends')
      .select('id, customer_id, clicked_at')
      .in('customer_id', slice)
      .eq('status', 'sent');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    sendRows.push(...((data ?? []) as any));
  }

  const clickedSendIds: string[] = [];
  const sendIdToCustomer = new Map<string, string>();
  for (const row of sendRows) {
    sendIdToCustomer.set(row.id, row.customer_id);
    if (row.clicked_at) {
      clickedSendIds.push(row.id);
      // Clicking at least once promotes cold -> warm; may be upgraded to
      // hot below once we look at what happened after the click.
      segments[row.customer_id] = 'warm';
    }
  }

  if (clickedSendIds.length > 0) {
    const pageCounts = new Map<string, Set<string>>(); // customer_id -> distinct page_path
    const purchasedCustomers = new Set<string>();

    for (let i = 0; i < clickedSendIds.length; i += CHUNK) {
      const slice = clickedSendIds.slice(i, i + CHUNK);
      const { data, error } = await supabase
        .from('activity_events')
        .select('campaign_send_id, event_type, page_path')
        .in('campaign_send_id', slice);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      for (const ev of data ?? []) {
        const customerId = sendIdToCustomer.get(ev.campaign_send_id as string);
        if (!customerId) continue;
        if (ev.event_type === 'purchase') {
          purchasedCustomers.add(customerId);
        }
        if (ev.event_type === 'page_view' && ev.page_path) {
          if (!pageCounts.has(customerId)) pageCounts.set(customerId, new Set());
          pageCounts.get(customerId)!.add(ev.page_path as string);
        }
      }
    }

    for (const customerId of Object.keys(segments)) {
      if (segments[customerId] !== 'warm') continue;
      const purchased = purchasedCustomers.has(customerId);
      const pagesVisited = pageCounts.get(customerId)?.size ?? 0;
      if (purchased || pagesVisited > 1) {
        segments[customerId] = 'hot';
      }
    }
  }

  const counts = { cold: 0, warm: 0, hot: 0, total: allIds.length };
  for (const s of Object.values(segments)) counts[s] += 1;

  return NextResponse.json({ segments, counts });
}
