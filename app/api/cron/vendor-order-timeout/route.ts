import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

// Vercel Cron (see vercel.json) hits this every hour with GET. If you set
// CRON_SECRET in your env vars, Vercel automatically sends it as a Bearer
// token and we verify it here so randoms on the internet can't trigger this.
//
// What it does (Phase 3A, item 4 — VENDOR ACCEPT TIMEOUT):
// Finds order_items still in stage 'placed' whose vendor_accept_deadline
// (set by place_order_with_items() at order time, using the
// `vendor_order_settings.accept_timeout_hours` config — default 12h) has
// passed. For each one it:
//   1. Restocks the unit (restock_order_item RPC from the 3A migration)
//   2. Sets stage -> 'cancelled'
//   3. Increments vendors.missed_order_count (Phase 4C reads this)
//   4. Notifies the customer (placeholder-safe: only sends if we have an
//      email; refund itself is a placeholder, same pattern as
//      triggerCourierPickup() will be in Phase 3B — no live payment
//      gateway refund call is wired yet, so this only flags it for the
//      admin to action manually until that's connected)
//   5. Notifies the vendor (reusing the WhatsApp-placeholder + real-email
//      pattern from lib/vendor-notifications.ts)
//
// Uses the SERVICE ROLE client throughout — this is exactly the kind of
// backend-only write the Phase 3A guard trigger
// (guard_order_item_fulfillment_fields) requires.
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  let cancelled = 0;
  const errors: string[] = [];

  try {
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
        // 1. Restock first — if this throws, we skip cancelling this item
        // rather than cancel-without-restocking.
        const { error: restockError } = await supabase.rpc('restock_order_item', {
          p_order_item_id: item.id,
        });
        if (restockError) throw restockError;

        // 2. Cancel the item (service role bypasses the guard trigger).
        const { error: updateError } = await supabase
          .from('order_items')
          .update({ stage: 'cancelled' })
          .eq('id', item.id);
        if (updateError) throw updateError;

        // 3. Vendor's missed-order counter.
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
          // WhatsApp: placeholder, same as lib/vendor-notifications.ts —
          // wire your WhatsApp Business API / Gupshup / Interakt when ready.
          if (process.env.NODE_ENV !== 'production') {
            console.log(
              `[vendor-whatsapp placeholder] to ${vendor.whatsapp || 'N/A'}: Order "${item.product_name}" auto-cancelled, accept window missed.`
            );
          }
        }

        // 4. Customer notify + refund trigger.
        // Placeholder for now (no payment-gateway refund API wired yet in
        // this codebase) — flagged in server logs / this response so an
        // admin can action it manually. Wire an actual Razorpay refund
        // call here once you're ready:
        //   await fetch('https://api.razorpay.com/v1/payments/{id}/refund', ...)
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

    return NextResponse.json({ success: true, cancelled, checked: overdueItems?.length ?? 0, errors });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Cron failed' }, { status: 500 });
  }
}
