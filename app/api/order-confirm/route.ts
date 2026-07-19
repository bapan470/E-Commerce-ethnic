import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/email';
import { orderConfirmationEmail } from '@/lib/email-templates';
import { DEFAULT_LOYALTY_SETTINGS, type LoyaltySettings } from '@/lib/loyalty-api';

// Called from the checkout page right after an order is created/confirmed
// (both COD and post-payment). Sends the order confirmation email and, if
// this customer had an abandoned-cart row, marks it recovered so the
// recovery cron leaves it alone.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const orderId = body?.orderId;
  if (!orderId) {
    return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
  }

  const supabase = getServerSupabase();

  try {
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.customer_email) {
      const { subject, html } = orderConfirmationEmail({
        id: order.id,
        customer_name: order.customer_name,
        items: Array.isArray(order.items) ? order.items : [],
        total_amount: order.total_amount,
        payment_method: order.payment_method,
      });
      await sendEmail({ to: order.customer_email, subject, html });

      // Best-effort: this customer just checked out, so any abandoned cart
      // row tied to their email is no longer "abandoned".
      await supabase
        .from('abandoned_carts')
        .update({ recovered: true })
        .eq('email', order.customer_email)
        .eq('recovered', false);
    }

    // Loyalty points — only for logged-in customers (guest checkouts have
    // no profile to credit). Runs once: if points were already recorded
    // for this order, skip (order-confirm can be called more than once).
    if (order.user_id) {
      const { data: existingEntries } = await supabase
        .from('loyalty_points_ledger')
        .select('id')
        .eq('order_id', order.id)
        .limit(1);

      if (!existingEntries || existingEntries.length === 0) {
        const { data: settingsRow } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'loyalty_program')
          .maybeSingle();
        const loyaltySettings: LoyaltySettings = {
          ...DEFAULT_LOYALTY_SETTINGS,
          ...((settingsRow?.value as Partial<LoyaltySettings>) ?? {}),
        };

        if (loyaltySettings.enabled) {
          // 1. Redeem — the checkout page already computed the discount;
          // just record the ledger entry here.
          if (order.loyalty_points_redeemed > 0) {
            await supabase.from('loyalty_points_ledger').insert({
              user_id: order.user_id,
              order_id: order.id,
              points: -order.loyalty_points_redeemed,
              type: 'redeem',
              reason: `Redeemed on order #${order.id.slice(0, 8)}`,
            });
          }

          // 2. Earn — points on what the customer actually paid.
          // `total_amount` is already net of the loyalty discount (the
          // checkout page subtracts it before creating the order), so no
          // further adjustment is needed here.
          const pointsEarned = Math.floor(
            (order.total_amount * loyaltySettings.points_per_100_rupees) / 100
          );

          if (pointsEarned > 0) {
            await supabase.from('loyalty_points_ledger').insert({
              user_id: order.user_id,
              order_id: order.id,
              points: pointsEarned,
              type: 'earn',
              reason: `Order #${order.id.slice(0, 8)}`,
            });
            await supabase
              .from('orders')
              .update({ loyalty_points_earned: pointsEarned })
              .eq('id', order.id);
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send confirmation email';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
