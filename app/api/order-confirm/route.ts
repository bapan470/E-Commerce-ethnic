import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

// Fired (best-effort, fire-and-forget from app/checkout/page.tsx -- its
// result is never read) right after an order is placed, for both COD and
// online payment. Its only real job today is to mark this customer's
// abandoned_carts row as recovered, so the abandoned-cart recovery cron
// (runAbandonedCartsJob in lib/cron-jobs.ts) stops emailing "you left
// something behind" for a cart that was already turned into an order.
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
      .select("id, customer_email")
      .eq("id", orderId)
      .maybeSingle();

    if (error) {
      console.error("[order-confirm] order lookup error:", error);
      return NextResponse.json({ error: "Failed to look up order" }, { status: 500 });
    }

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Clear this customer's abandoned cart, if any -- best-effort, never
    // blocks order confirmation.
    if (order.customer_email) {
      try {
        await supabase
          .from("abandoned_carts")
          .update({ recovered: true })
          .eq("email", order.customer_email)
          .eq("recovered", false);
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
