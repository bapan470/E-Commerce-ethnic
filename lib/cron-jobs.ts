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

import { getServerSupabase } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendEmail } from '@/lib/email';
import { cartRecoveryEmail, welcomeSeriesEmail, winbackEmail } from '@/lib/email-templates';

// ----------------------------- Abandoned carts -----------------------------
export async function runAbandonedCartsJob() {
  const supabase = getServerSupabase();
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
  const supabase = getServerSupabase();
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

// ----------------------------- Stuck vendor listings (safety net) -----------------------------
// Vendor products go to 'pending_review' right after creation, and are
// supposed to flip to 'live' once /api/vendor/ai-process/[id] finishes
// (with or without AI-generated fields). If that route's function gets
// killed mid-flight (e.g. platform function timeout) or the client's
// fire-and-forget call never lands, a product can get stuck in
// pending_review forever. This job is the safety net: anything that's
// been pending_review for longer than STUCK_MINUTES gets force-published
// as-is, so vendors never lose a listing permanently.
const STUCK_MINUTES = 10;

export async function runStuckVendorListingsJob() {
  const supabase = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - STUCK_MINUTES * 60 * 1000).toISOString();

  const { data: stuckProducts, error } = await supabase
    .from('products')
    .select('id, name, vendor_id, approval_status_changed_at')
    .eq('approval_status', 'pending_review')
    .lte('approval_status_changed_at', cutoff);

  if (error) throw error;

  let published = 0;
  const errors: string[] = [];

  for (const product of stuckProducts ?? []) {
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

  return { checked: stuckProducts?.length ?? 0, published, errors };
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
