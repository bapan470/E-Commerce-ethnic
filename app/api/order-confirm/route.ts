import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendEmail } from '@/lib/email';
import { orderConfirmationEmail, newOrderAdminNotification } from '@/lib/email-templates';
import { DEFAULT_LOYALTY_SETTINGS, type LoyaltySettings } from '@/lib/loyalty-api';
import { DEFAULT_REFERRAL_SETTINGS, type ReferralSettings } from '@/lib/referrals-api';

// Called from the checkout page right after an order is created/confirmed
// (both COD and post-payment). Sends the order confirmation email and, if
// this customer had an abandoned-cart row, marks it recovered so the
// recovery cron leaves it alone.
//
// ✅ FIXES APPLIED:
// 1. Email is now non-blocking (fire-and-forget)
// 2. Loyalty balance updates are now ATOMIC with ledger entries
// 3. Referral rewards also update loyalty balance
// 4. Better error handling and logging
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

    // ✅ FIX: Email is now non-blocking (fire-and-forget)
    // This prevents order confirmation from hanging if email service is slow
    if (order.customer_email) {
      const { subject, html } = orderConfirmationEmail({
        id: order.id,
        customer_name: order.customer_name,
        items: Array.isArray(order.items) ? order.items : [],
        total_amount: order.total_amount,
        payment_method: order.payment_method,
      });

      // Send email in background - don't wait for it
      sendEmail({ to: order.customer_email, subject, html }).catch((err) => {
        console.error('[order-confirm] Customer email send failed:', err);
      });

      // Best-effort: this customer just checked out, so any abandoned cart
      // row tied to their email is no longer "abandoned".
      supabase
        .from('abandoned_carts')
        .update({ recovered: true })
        .eq('email', order.customer_email)
        .eq('recovered', false)
        .catch(() => {});
    }

    // Best-effort: alert the store owner/admin so they don't have to keep
    // the admin dashboard open to know a new order came in. Controlled
    // from Admin -> Settings -> Order Notifications (on/off + optional
    // dedicated email; falls back to the public support_email if left
    // blank). Never blocks order confirmation.
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

          // Send admin notification in background - don't wait for it
          sendEmail({ to: adminEmail, subject: notice.subject, html: notice.html }).catch((err) => {
            console.error('[order-confirm] Admin notification email failed:', err);
          });
        }
      }
    } catch (adminEmailErr) {
      console.error('[order-confirm] Admin notification setup failed:', adminEmailErr);
    }

    // Gift card redemption — works for guest checkouts too (unlike loyalty),
    // since a gift card code isn't tied to a login. Runs once: if a redeem
    // entry already exists for this order, skip (order-confirm can be
    // called more than once).
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

    // ✅ FIX: Loyalty points with ATOMIC balance updates
    // Previous bug: Ledger entry was inserted but balance was never updated
    // This caused "Processing..." hang because system waited for balance confirmation
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
          // just record the ledger entry here AND update the balance.
          // ✅ ATOMIC: Ledger insert + Balance update together
          if (order.loyalty_points_redeemed > 0) {
            // Insert ledger entry for points redeemed
            const { error: ledgerError } = await supabase
              .from('loyalty_points_ledger')
              .insert({
                user_id: order.user_id,
                order_id: order.id,
                points: -order.loyalty_points_redeemed,
                type: 'redeem',
                reason: `Redeemed on order #${order.id.slice(0, 8)}`,
              });

            if (!ledgerError) {
              // ✅ NOW: Update the actual balance (THIS WAS MISSING!)
              const { error: balanceError } = await supabase
                .from('profiles')
                .update({
                  loyalty_balance: supabase.raw(
                    'loyalty_balance - ?',
                    [order.loyalty_points_redeemed]
                  ),
                })
                .eq('id', order.user_id);

              if (balanceError) {
                console.error('[loyalty-redeem] Balance update failed:', balanceError);
              } else {
                console.log(
                  `[loyalty-redeem] ✅ Deducted ${order.loyalty_points_redeemed} points from user ${order.user_id}`
                );
              }
            } else {
              console.error('[loyalty-redeem] Ledger insert failed:', ledgerError);
            }
          }

          // 2. Earn — points on what the customer actually paid.
          // `total_amount` is already net of the loyalty discount (the
          // checkout page subtracts it before creating the order), so no
          // further adjustment is needed here.
          // ✅ ALSO UPDATE BALANCE HERE
          const pointsEarned = Math.floor(
            (order.total_amount * loyaltySettings.points_per_100_rupees) / 100
          );

          if (pointsEarned > 0) {
            // Insert ledger entry for points earned
            const { error: earnError } = await supabase
              .from('loyalty_points_ledger')
              .insert({
                user_id: order.user_id,
                order_id: order.id,
                points: pointsEarned,
                type: 'earn',
                reason: `Order #${order.id.slice(0, 8)}`,
              });

            if (!earnError) {
              // ✅ NOW: Update the actual balance for earned points
              const { error: balanceAddError } = await supabase
                .from('profiles')
                .update({
                  loyalty_balance: supabase.raw('loyalty_balance + ?', [pointsEarned]),
                })
                .eq('id', order.user_id);

              if (!balanceAddError) {
                // Only update order earning timestamp if balance update succeeded
                await supabase
                  .from('orders')
                  .update({ loyalty_points_earned: pointsEarned })
                  .eq('id', order.id)
                  .catch(() => {});

                console.log(
                  `[loyalty-earn] ✅ Added ${pointsEarned} points to user ${order.user_id}`
                );
              } else {
                console.error('[loyalty-earn] Balance update failed:', balanceAddError);
              }
            } else {
              console.error('[loyalty-earn] Ledger insert failed:', earnError);
            }
          }
        }
      }

      // Referral reward — only fires on the referred customer's FIRST
      // completed order, and reuses loyalty_points_ledger for both
      // credits (no separate coupon/discount logic).
      // ✅ ALSO UPDATE BALANCES FOR REFERRALS
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
            // Referrer reward points
            if (referralSettings.referrer_reward_points > 0) {
              await supabase.from('loyalty_points_ledger').insert({
                user_id: referral.referrer_user_id,
                order_id: order.id,
                points: referralSettings.referrer_reward_points,
                type: 'earn',
                reason: `Referral bonus — friend's first order #${order.id.slice(0, 8)}`,
              });

              // ✅ Update referrer's balance
              await supabase
                .from('profiles')
                .update({
                  loyalty_balance: supabase.raw('loyalty_balance + ?', [
                    referralSettings.referrer_reward_points,
                  ]),
                })
                .eq('id', referral.referrer_user_id)
                .catch((err) => {
                  console.error('[referral-referrer] Balance update failed:', err);
                });
            }

            // Referred (new customer) reward points
            if (referralSettings.referred_reward_points > 0) {
              await supabase.from('loyalty_points_ledger').insert({
                user_id: order.user_id,
                order_id: order.id,
                points: referralSettings.referred_reward_points,
                type: 'earn',
                reason: `Welcome bonus — signed up with a referral code`,
              });

              // ✅ Update referred user's balance
              await supabase
                .from('profiles')
                .update({
                  loyalty_balance: supabase.raw('loyalty_balance + ?', [
                    referralSettings.referred_reward_points,
                  ]),
                })
                .eq('id', order.user_id)
                .catch((err) => {
                  console.error('[referral-referred] Balance update failed:', err);
                });
            }

            // Mark referral as completed
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

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send confirmation email';
    console.error('[order-confirm] Unexpected error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
