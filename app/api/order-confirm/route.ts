import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: NextRequest) {
  try {
    const { data } = await req.json();

    if (!data || !data.custom || !data.custom.order_id) {
      return NextResponse.json(
        { error: "Invalid webhook data" },
        { status: 400 }
      );
    }

    const order_id = data.custom.order_id;

    // Update the order status in Supabase
    const { data: updatedOrder, error } = await supabase
      .from("orders")
      .update({
        order_status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("order_id", order_id)
      .select();

    if (error) {
      console.error("Order update error:", error);
      return NextResponse.json(
        { error: "Failed to update order" },
        { status: 500 }
      );
    }

    // Get the order details
    const order = updatedOrder?.[0];

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    // Clear abandoned cart if exists
    if (order.customer_email) {
      await supabase
        .from("abandoned_carts")
        .update({ recovered: true })
        .eq('email', order.customer_email)
        .eq('recovered', false)
        .then(() => {})
        .catch(() => {});
    }

    // Best-effort: alert the store owner/admin so they don't have to keep
    // checking for new sales.
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/notify-new-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order_id: order.order_id,
          customer_name: order.customer_name,
          total_amount: order.total_amount,
        }),
      });
    } catch (err) {
      console.log("Notification error (non-critical):", err);
    }

    return NextResponse.json({
      success: true,
      order_id: order.order_id,
      message: "Order confirmed successfully",
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
