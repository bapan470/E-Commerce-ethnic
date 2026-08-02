// ---------------------------------------------------------------------
// Shared cron job logic.
//
// Vercel's Hobby (free) plan only allows 2 cron jobs, and they can only
// run once a day (no hourly crons). This repo has 5 separate jobs, so
// we consolidate them into 2 actual Vercel cron entries (see
// vercel.json) that both run once daily:
//
//   /api/cron/daily-jobs         -> abandoned-carts + email-automation +
//                                    vendor-return-timers + (Mondays only)
//                                    vendor-settlement
//   /api/cron/vendor-order-timeout -> now runs once/day instead of hourly
//
// Each job's logic lives here as a plain function so it can be reused:
//  - by the consolidated daily-jobs route (cron trigger)
//  - by the original /api/cron/<name> routes, which still exist so you
//    can trigger any single job manually (e.g. for testing) without
//    waiting for the schedule.
//
// NOTHING about what each job actually does has changed — this is a
// pure refactor (move code into functions), not a logic change.
// ---------------------------------------------------------------------

import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendEmail } from '@/lib/email';
import {
  cartRecoveryEmail,
  welcomeSeriesEmail,
  winbackEmail,
  vendorProductLiveEmail,
  vendorProductEditLiveEmail,
} from '@/lib/email-templates';
import { publishVendorProductWithAI } from '@/lib/vendor-ai-listing';
import { checkPickupStatusForReturn, getReturnAutomationMode } from '@/lib/return-automation';
import { trackDelhiveryShipment } from '@/lib/delhivery-api';
import { recordReturnRiskIncident } from '@/lib/return-risk-api';

// ----------------------------- Abandoned carts -----------------------------
export async function runAbandonedCartsJob() {
  // SECURITY/FIX: abandoned_carts is now locked to service_role only
  // (see 20260826020000_lock_newsletter_abandoned_stock_pii.sql) since
  // no client component ever needed anon access to it. This job — and
  // app/api/cart-track/route.ts — now use the admin client instead.
  const supabase = getSupabaseAdmin();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: carts, error } = await supabase
    .from('abandoned_carts')
    .select('*')
    .eq('recovery_email_sent', false)
    .eq('recovered', false)
    .not('email', 'is', null)
    .lte('last_activity_at', oneHourAgo);

  if (error) throw error;

  let sent = 0;
  for (const cart of carts || []) {
    const { subject, html } = cartRecoveryEmail({
      items: Array.isArray(cart.items) ? cart.items : [],
      cart_value: cart.cart_value,
    });
    const result = await sendEmail({ to: cart.email, subject, html });
    if (result.success) {
      await supabase
        .from('abandoned_carts')
        .update({ recovery_email_sent: true, recovery_email_sent_at: new Date().toISOString() })
        .eq('id', cart.id);
      sent++;
    }
  }

  return { checked: carts?.length || 0, sent };
}

// ----------------------------- Email automation -----------------------------
const DEFAULT_SETTINGS = {
  welcome_enabled: false,
  welcome_delay_hours: 1,
  welcome_coupon_code: 'WELCOME10',
  winback_enabled: false,
  winback_days_inactive: 45,
  winback_coupon_code: 'COMEBACK15',
};

export async function runEmailAutomationJob() {
  // FIX: this background job has no logged-in user/session, so once
  // `orders` SELECT was locked to `TO authenticated` only (see
  // 20260827000000_lock_orders_order_items_pii.sql), the win-back
  // query below silently returned zero rows using the anon client —
  // win-back emails stopped sending with no visible error. A
  // background job should always use the admin client; it never has
  // real user auth context for RLS to check against anyway.
  const supabase = getSupabaseAdmin();
  let welcomeSent = 0;
  let winbackSent = 0;

  const { data: settingsRow } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'email_automation_settings')
    .maybeSingle();
  const settings = { ...DEFAULT_SETTINGS, ...(settingsRow?.value || {}) };

  // ---------------- Welcome series ----------------
  if (settings.welcome_enabled) {
    const admin = getSupabaseAdmin();
    const { data: userList } = await admin.auth.admin.listUsers({ perPage: 200 });
    const cutoff = Date.now() - settings.welcome_delay_hours * 60 * 60 * 1000;
    const windowStart = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const candidates = (userList?.users || []).filter((u) => {
      const createdAt = new Date(u.created_at).getTime();
      return createdAt <= cutoff && createdAt >= windowStart && u.email;
    });

    for (const u of candidates) {
      const email = (u.email || '').toLowerCase();
      const { data: existing } = await supabase
        .from('email_automation_log')
        .select('id')
        .eq('email', email)
        .eq('automation_type', 'welcome')
        .maybeSingle();
      if (existing) continue;

      const { subject, html } = welcomeSeriesEmail({
        full_name: (u.user_metadata as any)?.full_name,
        coupon_code: settings.welcome_coupon_code,
      });
      const result = await sendEmail({ to: email, subject, html });
      if (result.success) {
        await supabase
          .from('email_automation_log')
          .insert({ email, user_id: u.id, automation_type: 'welcome' });
        welcomeSent++;
      }
    }
  }

  // ---------------- Win-back ----------------
  if (settings.winback_enabled) {
    const cutoffDate = new Date(
      Date.now() - settings.winback_days_inactive * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: orders } = await supabase
      .from('orders')
      .select('customer_email, customer_name, user_id, created_at')
      .not('customer_email', 'is', null)
      .order('created_at', { ascending: false });

    const lastOrderByEmail = new Map<string, { date: string; name: string | null; userId: string | null }>();
    for (const o of orders || []) {
      const email = (o.customer_email || '').toLowerCase().trim();
      if (!email || lastOrderByEmail.has(email)) continue;
      lastOrderByEmail.set(email, { date: o.created_at, name: o.customer_name, userId: o.user_id });
    }

    for (const [email, info] of Array.from(lastOrderByEmail)) {
      if (info.date > cutoffDate) continue;

      const { data: existing } = await supabase
        .from('email_automation_log')
        .select('id')
        .eq('email', email)
        .eq('automation_type', 'winback')
        .maybeSingle();
      if (existing) continue;

      const { subject, html } = winbackEmail({
        full_name: info.name || undefined,
        coupon_code: settings.winback_coupon_code,
      });
      const result = await sendEmail({ to: email, subject, html });
      if (result.success) {
        await supabase
          .from('email_automation_log')
          .insert({ email, user_id: info.userId, automation_type: 'winback' });
        winbackSent++;
      }
    }
  }

  return { welcomeSent, winbackSent };
}

// ----------------------------- Vendor order timeout -----------------------------
export async function runVendorOrderTimeoutJob() {
  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  let cancelled = 0;
  const errors: string[] = [];

  const { data: overdueItems, error } = await supabase
    .from('order_items')
    .select('id, order_id, product_name, quantity, vendor_id, price')
    .eq('stage', 'placed')
    .not('vendor_id', 'is', null)
    .not('vendor_accept_deadline', 'is', null)
    .lte('vendor_accept_deadline', nowIso);

  if (error) throw error;

  for (const item of overdueItems ?? []) {
    try {
      const { error: restockError } = await supabase.rpc('restock_order_item', {
        p_order_item_id: item.id,
      });
      if (restockError) throw restockError;

      const { error: updateError } = await supabase
        .from('order_items')
        .update({ stage: 'cancelled' })
        .eq('id', item.id);
      if (updateError) throw updateError;

      const { data: vendor } = await supabase
        .from('vendors')
        .select('id, business_name, email, whatsapp, missed_order_count')
        .eq('id', item.vendor_id)
        .maybeSingle();

      if (vendor) {
        await supabase
          .from('vendors')
          .update({ missed_order_count: (vendor.missed_order_count ?? 0) + 1 })
          .eq('id', vendor.id);

        if (vendor.email) {
          await sendEmail({
            to: vendor.email,
            subject: `Order auto-cancelled — accept window missed`,
            html: `<p>Namaste ${vendor.business_name},</p><p>Order item "${item.product_name}" (qty ${item.quantity}) auto-cancel ho gaya hai kyunki accept-window ke andar accept nahi kiya gaya. Stock wapas add kar diya gaya hai.</p><p>Agar ye baar-baar ho raha hai, kripya apni order-accept response time improve karein.</p>`,
          }).catch(() => {});
        }
        if (process.env.NODE_ENV !== 'production') {
          console.log(
            `[vendor-whatsapp placeholder] to ${vendor.whatsapp || 'N/A'}: Order "${item.product_name}" auto-cancelled, accept window missed.`
          );
        }
      }

      const { data: order } = await supabase
        .from('orders')
        .select('customer_email, customer_name, payment_method')
        .eq('id', item.order_id)
        .maybeSingle();

      if (order?.customer_email) {
        await sendEmail({
          to: order.customer_email,
          subject: `Update on your order — an item was cancelled`,
          html: `<p>Hi ${order.customer_name || ''},</p><p>Unfortunately "${item.product_name}" (qty ${item.quantity}) from your order could not be processed in time and has been cancelled.${
            order.payment_method === 'cod'
              ? ''
              : ' Your refund for this item will be processed shortly.'
          }</p><p>We're sorry for the inconvenience.</p>`,
        }).catch(() => {});
      }

      cancelled += 1;
    } catch (itemErr: any) {
      errors.push(`order_item ${item.id}: ${itemErr?.message || itemErr}`);
    }
  }

  return { cancelled, checked: overdueItems?.length ?? 0, errors };
}

// ----------------------------- Vendor return timers -----------------------------
export async function runVendorReturnTimersJob() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc('run_return_to_vendor_scan');
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  return {
    never_sold_flagged: row?.never_sold_flagged ?? 0,
    cancelled_returned_flagged: row?.cancelled_returned_flagged ?? 0,
  };
}

// ----------------------------- Vendor stock-hold timers -----------------------------
// Opens a hold the moment a unit comes back to the warehouse (return or
// RTO), auto-resolves it if a repeat order for the same product shows
// up, and flags it into Return to Vendor once the vendor's own
// configured hold window (15-30 days) runs out with nothing resold.
// See supabase/migrations/20260912000000_vendor_stock_hold_and_unsold_return.sql
export async function runVendorStockHoldScanJob() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc('run_vendor_return_hold_scan');
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  return {
    holds_opened: row?.holds_opened ?? 0,
    holds_resolved_resold: row?.holds_resolved_resold ?? 0,
    holds_flagged: row?.holds_flagged ?? 0,
  };
}

// ----------------------------- Stuck vendor listings (safety net) -----------------------------
// Vendor products go to 'pending_review' right after creation (or after an
// edit), and are supposed to flip to 'live' once /api/vendor/ai-process/[id]
// finishes. If that route's function gets killed mid-flight (e.g. Vercel
// Hobby's 60s function budget) or the client's fire-and-forget call never
// lands, a product can get stuck in pending_review forever.
//
// This job is the safety net: anything that's been pending_review for
// longer than STUCK_MINUTES gets recovered. It used to just force
// `approval_status: 'live'` with no other changes, which meant a stuck
// listing went live PERMANENTLY with the vendor's raw placeholder
// name/slug and no AI description/highlights — the AI step was simply
// skipped, not retried. It now actually retries AI generation first (via
// the same publishVendorProductWithAI helper the normal ai-process route
// uses), so a listing that got stuck still ends up with its real
// generated title, matching slug, description and highlights — it only
// falls back to a bare publish if the AI call itself genuinely fails
// (e.g. NVIDIA_API_KEY missing, model error).
//
// AI recovery is capped to a small batch per run (STUCK_AI_BATCH_LIMIT) —
// each AI call can take up to ~50s, and this job also runs inline from
// page loads (see app/api/vendor/products/route.ts) and alongside other
// jobs in /api/cron/daily-jobs, both of which need to stay within Vercel's
// function time budget. Anything beyond the batch on a given run still
// gets a bare publish so nothing is ever left stuck indefinitely — it
// will simply get the AI treatment on the NEXT run instead (oldest-first).
const STUCK_MINUTES = 10;
const STUCK_AI_BATCH_LIMIT = 3;

export async function runStuckVendorListingsJob() {
  const supabase = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - STUCK_MINUTES * 60 * 1000).toISOString();

  const { data: stuckProducts, error } = await supabase
    .from('products')
    .select('id, name, fabric, category_name, images, slug, vendor_id, vendor_edit_count, approval_status_changed_at')
    .eq('approval_status', 'pending_review')
    .lte('approval_status_changed_at', cutoff)
    .order('approval_status_changed_at', { ascending: true });

  if (error) throw error;

  const toRecoverWithAI = (stuckProducts ?? []).slice(0, STUCK_AI_BATCH_LIMIT);
  const toBarePublish = (stuckProducts ?? []).slice(STUCK_AI_BATCH_LIMIT);

  let published = 0;
  const errors: string[] = [];

  // Preload vendor contact info for the batch that's getting the email
  // notification (same notification the normal ai-process route sends).
  const vendorIds = Array.from(new Set(toRecoverWithAI.map((p) => p.vendor_id).filter(Boolean)));
  const vendorMap = new Map<string, { email: string; displayName: string }>();
  if (vendorIds.length > 0) {
    const { data: vendors } = await supabase
      .from('vendors')
      .select('id, email, business_name, owner_name')
      .in('id', vendorIds);
    for (const v of vendors ?? []) {
      vendorMap.set(v.id, {
        email: (v.email || '').trim(),
        displayName: v.owner_name || v.business_name || 'Vendor',
      });
    }
  }

  for (const product of toRecoverWithAI) {
    try {
      // A row that's been edited before (vendor_edit_count > 0) is being
      // re-processed as an edit — same rule as the normal ai-process
      // route: keep its existing slug, don't re-run the unique-title check.
      const isEdit = Number(product.vendor_edit_count ?? 0) > 0;
      const { finalName, aiApplied } = await publishVendorProductWithAI(supabase, product, isEdit);
      if (!aiApplied) {
        errors.push(`product ${product.id}: AI unavailable/failed, published with basic fields only`);
      }
      published++;

      const vendorInfo = product.vendor_id ? vendorMap.get(product.vendor_id) : undefined;
      if (vendorInfo?.email) {
        const emailInput = { vendorName: vendorInfo.displayName, productName: finalName || product.name };
        const { subject, html } = isEdit
          ? vendorProductEditLiveEmail(emailInput)
          : vendorProductLiveEmail(emailInput);
        await sendEmail({ to: vendorInfo.email, subject, html }).catch((emailErr) => {
          console.error('[runStuckVendorListingsJob] email send failed for', vendorInfo.email, emailErr);
        });
      }

      // Social posting is no longer automatic — even for listings recovered
      // by this safety-net job. Facebook/Instagram/Threads posting only
      // happens when the admin clicks the Share button on the product.
    } catch (itemErr: any) {
      errors.push(`product ${product.id}: ${itemErr?.message || itemErr}`);
      // Even if the AI-recovery path itself threw, don't leave the row
      // stuck — fall back to a bare publish.
      try {
        await supabase.from('products').update({ approval_status: 'live' }).eq('id', product.id);
        published++;
      } catch (fallbackErr: any) {
        errors.push(`product ${product.id}: fallback publish also failed: ${fallbackErr?.message || fallbackErr}`);
      }
    }
  }

  for (const product of toBarePublish) {
    try {
      const { error: updateError } = await supabase
        .from('products')
        .update({ approval_status: 'live' })
        .eq('id', product.id);
      if (updateError) throw updateError;
      published++;
    } catch (itemErr: any) {
      errors.push(`product ${product.id}: ${itemErr?.message || itemErr}`);
    }
  }

  // 'awaiting_stock' was the old manual-review flow's holding status
  // (Admin > Vendor Submissions > "Approve"). That manual gate has been
  // removed — nothing sets this status anymore — but nothing ever moved
  // 'awaiting_stock' rows to 'live' either, so any product an admin had
  // previously approved under the old flow was stuck there permanently.
  // Publish those immediately (no time threshold needed; this status is
  // fully retired going forward, so anything sitting here is legacy).
  const { data: awaitingStockProducts, error: awaitingErr } = await supabase
    .from('products')
    .select('id, name, vendor_id')
    .eq('approval_status', 'awaiting_stock');

  if (awaitingErr) throw awaitingErr;

  let publishedFromAwaitingStock = 0;
  for (const product of awaitingStockProducts ?? []) {
    try {
      const { error: updateError } = await supabase
        .from('products')
        .update({ approval_status: 'live' })
        .eq('id', product.id);
      if (updateError) throw updateError;
      publishedFromAwaitingStock++;
    } catch (itemErr: any) {
      errors.push(`product ${product.id} (awaiting_stock): ${itemErr?.message || itemErr}`);
    }
  }

  return {
    checked: (stuckProducts?.length ?? 0) + (awaitingStockProducts?.length ?? 0),
    published: published + publishedFromAwaitingStock,
    errors,
  };
}


// ----------------------------- Vendor settlement (weekly) -----------------------------
export async function runVendorSettlementJob() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc('run_weekly_vendor_settlement');
  if (error) throw error;

  return {
    settlements_created: data?.length ?? 0,
    settlements: data ?? [],
  };
}

// ----------------------------- Return pickup tracking -----------------------------
// Polls Delhivery for every return with a reverse-pickup in flight
// (scheduled/picked_up/in_transit) and, once it shows delivered back
// to the warehouse, marks it received and — in automatic mode — fires
// the Razorpay refund. See lib/return-automation.ts for the per-return
// logic; this job just fans it out across all in-flight returns.
export async function runReturnPickupTrackingJob() {
  const supabase = getSupabaseAdmin();

  const { data: returns, error } = await supabase
    .from('returns')
    .select('*')
    .in('pickup_status', ['scheduled', 'picked_up', 'in_transit'])
    .not('pickup_waybill', 'is', null);
  if (error) throw error;

  if (!returns || returns.length === 0) {
    return { checked: 0, received: 0, refunded: 0, errors: [] as string[] };
  }

  const mode = await getReturnAutomationMode(supabase);
  const orderIds = Array.from(new Set(returns.map((r) => r.order_id)));
  const { data: orders } = await supabase
    .from('orders')
    .select(
      'id, customer_name, customer_email, customer_phone, shipping_address, items, total_amount, payment_method, razorpay_payment_id'
    )
    .in('id', orderIds);
  const ordersById = new Map((orders || []).map((o) => [o.id, o]));

  let received = 0;
  let refunded = 0;
  const errors: string[] = [];

  for (const ret of returns) {
    const order = ordersById.get(ret.order_id);
    if (!order) {
      errors.push(`return ${ret.id}: order ${ret.order_id} not found`);
      continue;
    }
    try {
      const result = await checkPickupStatusForReturn(supabase, ret, order, mode);
      if (result.pickup_status === 'received') received++;
      if (result.refund_triggered) refunded++;
    } catch (err: any) {
      errors.push(`return ${ret.id}: ${err?.message || err}`);
    }
  }

  return { checked: returns.length, received, refunded, errors };
}

// ----------------------- Forward shipment live tracking -----------------------
// Polls Delhivery for every order that has a forward-leg waybill
// (orders.tracking_number, set by Admin -> "Create Shipment") and isn't
// already in a terminal state, then writes the plain-language status
// into orders.delivery_status so both the Admin panel and the Vendor
// dashboard (app/api/vendor/orders — order-level only, no customer
// data) can show a live "where is it" badge without either of them
// calling Delhivery directly.
//
// The FIRST time a shipment's status reads as RTO (Delhivery couldn't
// deliver and is sending it back), this also records a return-risk
// incident against the customer's phone (lib/return-risk-api.ts) — the
// `delivery_status !== 'rto_initiated' && delivery_status !== 'rto_delivered'`
// guard below makes sure that only happens once per order, not on every
// daily poll while the RTO parcel is still in transit back.
export async function runForwardShipmentTrackingJob() {
  const supabase = getSupabaseAdmin();

  const { data: allTracked, error } = await supabase
    .from('orders')
    .select('id, customer_phone, tracking_number, status, delivery_status')
    .not('tracking_number', 'is', null);
  if (error) throw error;

  // Filtered in JS, not SQL: a plain `.not('delivery_status', 'in', ...)`
  // would also exclude every row where delivery_status is still NULL
  // (SQL's `NULL NOT IN (...)` is NULL, not true) — which is exactly the
  // freshly-shipped orders this job most needs to check.
  const orders = (allTracked || []).filter(
    (o) => o.delivery_status !== 'delivered' && o.delivery_status !== 'rto_delivered'
  );

  if (orders.length === 0) {
    return { checked: 0, delivered: 0, rto: 0, errors: [] as string[] };
  }

  let delivered = 0;
  let rto = 0;
  const errors: string[] = [];

  for (const order of orders) {
    try {
      const tracking = await trackDelhiveryShipment(order.tracking_number as string);
      await supabase
        .from('orders')
        .update({ delivery_last_checked_at: new Date().toISOString() })
        .eq('id', order.id);

      if (!tracking.tracked || !tracking.currentStatus) continue;

      const statusText = tracking.currentStatus.toLowerCase();
      let nextStatus = order.delivery_status;

      if (statusText.includes('rto')) {
        // Delhivery shows a distinct "RTO Delivered" once it's actually
        // back at our warehouse, vs just "RTO Initiated"/"in transit" —
        // either way it's already a lost/returned forward shipment.
        nextStatus = statusText.includes('deliver') ? 'rto_delivered' : 'rto_initiated';
      } else if (statusText.includes('deliver')) {
        nextStatus = 'delivered';
      } else if (statusText.includes('transit') || statusText.includes('dispatch') || statusText.includes('pending')) {
        nextStatus = 'in_transit';
      }

      if (nextStatus === order.delivery_status) continue;

      await supabase
        .from('orders')
        .update({ delivery_status: nextStatus, delivery_status_updated_at: new Date().toISOString() })
        .eq('id', order.id);

      const wasAlreadyRto = order.delivery_status === 'rto_initiated' || order.delivery_status === 'rto_delivered';
      if ((nextStatus === 'rto_initiated' || nextStatus === 'rto_delivered') && !wasAlreadyRto) {
        rto++;
        recordReturnRiskIncident(supabase, order.customer_phone, 'rto').catch(() => {});
      }
      if (nextStatus === 'delivered') delivered++;
    } catch (err: any) {
      errors.push(`order ${order.id}: ${err?.message || err}`);
    }
  }

  return { checked: orders.length, delivered, rto, errors };
}
