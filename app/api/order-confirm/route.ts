import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendEmail } from '@/lib/email';
import { orderConfirmationEmail, newOrderAdminNotification } from '@/lib/email-templates';
import { DEFAULT_LOYALTY_SETTINGS, type LoyaltySettings } from '@/lib/loyalty-api';
import { DEFAULT_REFERRAL_SETTINGS, type ReferralSettings } from '@/lib/referrals-api';

// Called from the checkout page (app/checkout/page.tsx) right after an
// order is created/confirmed -- both COD and post-payment. Fire-and-forget
// from the client (`fetch(...).catch(() => {})`), so this must never throw
// in a way that leaves things half-done, and must be safe to call more
// than once for the same order (retries on a flaky connection, etc).
//
// Five jobs, each independently best-effort:
//   1. Customer "order confirmed" email + admin "new order" email.
//   2. Clear this customer's abandoned-cart row, if any.
//   3. Gift card redemption (guest-checkout safe -- not tied to a login).
//   4. Loyalty points (redeem + earn) -- logged-in customers only.
//   5. Referral reward, on the referred customer's first completed order.
//
// REGRESSION HISTORY (see git log on this file): jobs 1, 3, 4, and 5 all
// existed and worked as of 4 Aug, and were further improved on 19 Aug
// (non-blocking email, this comment block). Later the same day the file
// was accidentally overwritten with a completely different, much older
// draft (a Razorpay-shaped webhook handler expecting `{ data: { custom:
// { order_id }}}` and writing to an `order_status` column that doesn't
// exist on `orders`) that had none of this -- wiping out the customer/
// admin emails, gift card redemption, loyalty points, and referral
// rewards in one shot. Two follow-up commits patched the abandoned-cart
// piece back to the new`{ orderId }` shape but never restored the rest.
//
// Also fixed while restoring: the pre-regression "19 Aug" version called
// `supabase.raw('loyalty_balance - ?', [...])` to update the balance
// after each ledger insert -- `.raw()` is a Knex/ActiveRecord-style
// method that does not exist on the `@supabase/supabase-js` client, so
// every one of those calls threw a TypeError at runtime for any
// logged-in customer earning/redeeming points, which aborted the rest
// of this route (referral rewards included) with an uncaught exception.
// It also turned out to be unnecessary: `loyalty_points_ledger` already
// has an AFTER INSERT trigger (`apply_loyalty_ledger_entry`, see
// supabase/migrations/20260722000000_phase10a_loyalty.sql) that keeps
// `profiles.loyalty_balance` in sync automatically. Same story for gift
// cards (`apply_gift_card_transaction` trigger). So this version simply
// inserts the ledger/transaction rows and lets those triggers do the
// balance math -- no manual balance update needed or attempted.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const orderId = body?.orderId;
  if (!orderId) {
    return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  try {
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // 1a. Customer "order confirmed" email -- fire-and-forget so a slow/
    // down email provider never delays order confirmation. Guarded by
    // confirmation_email_sent_at so a retried call from the client never
    // double-sends.
    if (order.customer_email && !order.confirmation_email_sent_at) {
      const { subject, html } = orderConfirmationEmail({
        id: order.id,
        customer_name: order.customer_name,
        items: Array.isArray(order.items) ? order.items : [],
        total_amount: order.total_amount,
        payment_method: order.payment_method,
      });

      sendEmail({ to: order.customer_email, subject, html })
        .then(() =>
          supabase
            .from('orders')
            .update({ confirmation_email_sent_at: new Date().toISOString() })
            .eq('id', order.id)
        )
        .catch((err) => {
          console.error('[order-confirm] Customer email send failed:', err);
        });
    }

    // 1b. Clear this customer's abandoned cart, if any -- they just
    // checked out, so it's no longer "abandoned". Also attributes the
    // conversion to whichever recovery emails went out for that cart (see
    // abandoned_cart_emails, added in 20260928010000_cart_recovery_sequence.sql).
    if (order.customer_email) {
      try {
        const { data: recoveredCarts } = await supabase
          .from('abandoned_carts')
          .update({ recovered: true })
          .eq('email', order.customer_email)
          .eq('recovered', false)
          .select('id');

        const cartIds = (recoveredCarts || []).map((c: { id: string }) => c.id);
        if (cartIds.length > 0) {
          await supabase
            .from('abandoned_cart_emails')
            .update({ converted: true, converted_at: new Date().toISOString() })
            .in('cart_id', cartIds)
            .eq('converted', false);
        }
      } catch (err) {
        console.log('Abandoned cart update error (non-critical):', err);
      }
    }

    // 1c. Admin "you've got a new order" email. Controlled from Admin ->
    // Settings -> Order Notifications (on/off + optional dedicated email;
    // falls back to the public support_email if left blank). Never blocks
    // order confirmation.
    try {
      const { data: orderNotifRow } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'order_notifications')
        .maybeSingle();
      const orderNotif = orderNotifRow?.value as { enabled?: boolean; email?: string } | null;
      const notifEnabled = orderNotif?.enabled !== false; // default ON if never configured

      if (notifEnabled) {
        let adminEmail = orderNotif?.email?.trim();
        if (!adminEmail) {
          const { data: storeInfoRow } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'store_info')
            .maybeSingle();
          adminEmail = (storeInfoRow?.value as { support_email?: string } | null)?.support_email;
        }

        if (adminEmail) {
          const notice = newOrderAdminNotification({
            id: order.id,
            customer_name: order.customer_name,
            customer_email: order.customer_email,
            customer_phone: order.customer_phone,
            items: Array.isArray(order.items) ? order.items : [],
            total_amount: order.total_amount,
            payment_method: order.payment_method,
          });

          sendEmail({ to: adminEmail, subject: notice.subject, html: notice.html }).catch((err) => {
            console.error('[order-confirm] Admin notification email failed:', err);
          });
        } else {
          console.warn(
            '[order-confirm] No admin/support email configured (Admin -> Settings) -- skipping new-order notification.'
          );
        }
      }
    } catch (adminEmailErr) {
      console.error('[order-confirm] Admin notification setup failed:', adminEmailErr);
    }

    // 2. Gift card redemption -- works for guest checkouts too (unlike
    // loyalty), since a gift card code isn't tied to a login. Runs once:
    // if a redeem entry already exists for this order, skip (order-confirm
    // can be called more than once for the same order).
    if (order.gift_card_code && order.gift_card_discount > 0) {
      const { data: card } = await supabase
        .from('gift_cards')
        .select('id')
        .eq('code', order.gift_card_code)
        .maybeSingle();

      if (card) {
        const { data: existingRedeem } = await supabase
          .from('gift_card_transactions')
          .select('id')
          .eq('gift_card_id', card.id)
          .eq('order_id', order.id)
          .limit(1);

        if (!existingRedeem || existingRedeem.length === 0) {
          // Trigger (apply_gift_card_transaction) deducts this from the
          // card's balance and flips status to 'redeemed' if it hits 0.
          await supabase.from('gift_card_transactions').insert({
            gift_card_id: card.id,
            order_id: order.id,
            amount: -order.gift_card_discount,
            type: 'redeem',
            reason: `Redeemed on order #${order.id.slice(0, 8)}`,
          });
        }
      }
    }

    // 3. Loyalty points -- logged-in customers only (guest checkouts have
    // no profile to credit). Runs once: if points were already recorded
    // for this order, skip. Balance itself is kept in sync automatically
    // by the trg_loyalty_ledger_apply DB trigger on insert below -- no
    // manual balance update here (see file header comment for why).
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
          // 3a. Redeem -- the checkout page already computed the discount;
          // just record the ledger entry, the trigger deducts the balance.
          if (order.loyalty_points_redeemed > 0) {
            const { error: ledgerError } = await supabase.from('loyalty_points_ledger').insert({
              user_id: order.user_id,
              order_id: order.id,
              points: -order.loyalty_points_redeemed,
              type: 'redeem',
              reason: `Redeemed on order #${order.id.slice(0, 8)}`,
            });
            if (ledgerError) {
              console.error('[loyalty-redeem] Ledger insert failed:', ledgerError);
            }
          }

          // 3b. Earn -- points on what the customer actually paid.
          // `total_amount` is already net of the loyalty discount (the
          // checkout page subtracts it before creating the order), so no
          // further adjustment is needed here.
          const pointsEarned = Math.floor(
            (order.total_amount * loyaltySettings.points_per_100_rupees) / 100
          );

          if (pointsEarned > 0) {
            const { error: earnError } = await supabase.from('loyalty_points_ledger').insert({
              user_id: order.user_id,
              order_id: order.id,
              points: pointsEarned,
              type: 'earn',
              reason: `Order #${order.id.slice(0, 8)}`,
            });

            if (!earnError) {
              // Supabase's query builder is thenable but isn't typed with a
              // `.catch()` method (it's not a plain Promise until you
              // `await`/`.then()` it) -- chaining `.catch()` directly on it
              // compiles fine in JS but fails `tsc` type-checking. Supabase
              // never throws on a failed update anyway (it resolves with
              // `{ error }` instead), so just await and check that.
              const { error: earnedUpdateError } = await supabase
                .from('orders')
                .update({ loyalty_points_earned: pointsEarned })
                .eq('id', order.id);
              if (earnedUpdateError) {
                console.error(
                  '[loyalty-earn] Failed to record loyalty_points_earned on order:',
                  earnedUpdateError
                );
              }
            } else {
              console.error('[loyalty-earn] Ledger insert failed:', earnError);
            }
          }
        }
      }

      // 4. Referral reward -- only fires on the referred customer's FIRST
      // completed order, and reuses loyalty_points_ledger for both
      // credits (no separate coupon/discount logic). Balance updates
      // again ride on the same DB trigger, not a manual update here.
      const { data: referral } = await supabase
        .from('referrals')
        .select('*')
        .eq('referred_user_id', order.user_id)
        .eq('status', 'pending')
        .maybeSingle();

      if (referral) {
        const { count: priorOrderCount } = await supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', order.user_id)
          .neq('id', order.id);

        // This is their first order (no other orders exist for this user).
        if (!priorOrderCount) {
          const { data: referralSettingsRow } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'referral_program')
            .maybeSingle();
          const referralSettings: ReferralSettings = {
            ...DEFAULT_REFERRAL_SETTINGS,
            ...((referralSettingsRow?.value as Partial<ReferralSettings>) ?? {}),
          };

          if (referralSettings.enabled) {
            if (referralSettings.referrer_reward_points > 0) {
              await supabase.from('loyalty_points_ledger').insert({
                user_id: referral.referrer_user_id,
                order_id: order.id,
                points: referralSettings.referrer_reward_points,
                type: 'earn',
                reason: `Referral bonus — friend's first order #${order.id.slice(0, 8)}`,
              });
            }

            if (referralSettings.referred_reward_points > 0) {
              await supabase.from('loyalty_points_ledger').insert({
                user_id: order.user_id,
                order_id: order.id,
                points: referralSettings.referred_reward_points,
                type: 'earn',
                reason: `Welcome bonus — signed up with a referral code`,
              });
            }

            await supabase
              .from('referrals')
              .update({
                status: 'completed',
                first_order_id: order.id,
                referrer_reward_points: referralSettings.referrer_reward_points,
                referred_reward_points: referralSettings.referred_reward_points,
                completed_at: new Date().toISOString(),
              })
              .eq('id', referral.id);
          }
        }
      }
    }

    return NextResponse.json({ success: true, order_id: order.id, message: 'Order confirmed successfully' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to confirm order';
    console.error('[order-confirm] Unexpected error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
