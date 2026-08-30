import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { orderConfirmationEmail, newOrderAdminNotification } from "@/lib/email-templates";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

// Fired (best-effort, fire-and-forget from app/checkout/page.tsx -- its
// result is never read) right after an order is placed, for both COD and
// online payment. Its two jobs:
//   1. Send the customer's "order confirmed" email + the admin's "new
//      order" notification email (orderConfirmationEmail() /
//      newOrderAdminNotification() in lib/email-templates.ts). These
//      templates existed but were never actually called from anywhere in
//      the codebase, so no new-order email ever went out to either side --
//      only later status-change emails (from updateOrderStatus() in
//      lib/orders-api.ts) did, which is why "pending"/"payment
//      confirmed"/"delivered" emails worked but the very first "thank you
//      for your order" one never arrived. Guarded by
//      confirmation_email_sent_at so a retried fire-and-forget call never
//      double-sends.
//   2. Mark this customer's abandoned_carts row as recovered, so the
//      abandoned-cart recovery cron (runAbandonedCartsJob in
//      lib/cron-jobs.ts) stops emailing "you left something behind" for a
//      cart that was already turned into an order.
//
// FIX: this previously expected a totally different webhook payload shape
// (`{ data: { custom: { order_id }}}`, from some earlier, non-Razorpay
// payment-gateway integration) and wrote to columns (`order_id`,
// `order_status`) that don't exist on `orders` (see
// supabase/migrations/20260716132537_boutique_schema.sql -- the real
// columns are `id` and `status`). Every call from checkout/page.tsx sends
// `{ orderId }`, which didn't match that shape at all, so this route
// always returned 400 and silently did nothing -- the abandoned-cart row
// never got marked recovered, and the "you left something behind" email
// could still go out for a cart the customer already checked out (and even
// cancelled/refunded). It also POSTed to /api/admin/notify-new-order,
// which doesn't exist in this codebase (the admin notification bell now
// reads pending orders directly in app/api/admin/notifications/route.ts),
// so that call has been removed.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const orderId = body?.orderId as string | undefined;

    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    const { data: order, error } = await supabase
      .from("orders")
      .select(
        "id, customer_email, customer_name, customer_phone, items, total_amount, payment_method, confirmation_email_sent_at"
      )
      .eq("id", orderId)
      .maybeSingle();

    if (error) {
      console.error("[order-confirm] order lookup error:", error);
      return NextResponse.json({ error: "Failed to look up order" }, { status: 500 });
    }

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Customer "thank you for your order" email + admin "you've got a new
    // order" email. Guarded by confirmation_email_sent_at so a retried
    // fire-and-forget call from checkout/page.tsx (see comment above)
    // never double-sends. Best-effort -- never blocks order confirmation,
    // same as the abandoned-cart update below.
    if (!order.confirmation_email_sent_at) {
      try {
        if (order.customer_email) {
          const { subject, html } = orderConfirmationEmail({
            id: order.id,
            customer_name: order.customer_name,
            items: order.items,
            total_amount: order.total_amount,
            payment_method: order.payment_method,
          });
          await sendEmail({ to: order.customer_email, subject, html });
        }

        const { data: storeInfoRow } = await supabase
          .from("settings")
          .select("value")
          .eq("key", "store_info")
          .maybeSingle();
        const supportEmail = (storeInfoRow?.value as { support_email?: string } | null)?.support_email;

        if (supportEmail) {
          const notice = newOrderAdminNotification({
            id: order.id,
            customer_name: order.customer_name,
            customer_email: order.customer_email,
            customer_phone: order.customer_phone,
            items: order.items,
            total_amount: order.total_amount,
            payment_method: order.payment_method,
          });
          await sendEmail({ to: supportEmail, subject: notice.subject, html: notice.html });
        } else {
          console.warn(
            "[order-confirm] No store support_email set in Admin -> Settings -- skipping new-order admin notification."
          );
        }

        await supabase
          .from("orders")
          .update({ confirmation_email_sent_at: new Date().toISOString() })
          .eq("id", orderId);
      } catch (emailErr) {
        console.error("[order-confirm] confirmation/admin-notification email failed:", emailErr);
      }
    }

    // Clear this customer's abandoned cart, if any -- best-effort, never
    // blocks order confirmation.
    if (order.customer_email) {
      try {
        const { data: recoveredCarts } = await supabase
          .from("abandoned_carts")
          .update({ recovered: true })
          .eq("email", order.customer_email)
          .eq("recovered", false)
          .select("id");

        // Attribute the conversion to every recovery email that went
        // out for this cart (see abandoned_cart_emails, added in
        // 20260928010000_cart_recovery_sequence.sql) -- lets Admin ->
        // Abandoned Carts show "recovered after N emails" instead of
        // just a plain recovered/not-recovered flag.
        const cartIds = (recoveredCarts || []).map((c: { id: string }) => c.id);
        if (cartIds.length > 0) {
          await supabase
            .from("abandoned_cart_emails")
            .update({ converted: true, converted_at: new Date().toISOString() })
            .in("cart_id", cartIds)
            .eq("converted", false);
        }
      } catch (err) {
        console.log("Abandoned cart update error (non-critical):", err);
      }
    }

    return NextResponse.json({
      success: true,
      order_id: order.id,
      message: "Order confirmed successfully",
    });
  } catch (err) {
    console.error("order-confirm error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
