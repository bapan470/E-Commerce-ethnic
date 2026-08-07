import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// SECURITY: this route now does the `orders` status update itself,
// using the service-role client, instead of just returning
// `verified: true` and letting the browser (anon key) write
// status: 'paid' directly. Previously, RLS allowed anon to update ANY
// order to ANY status regardless of whether this route was ever
// called — so a payment could be "verified" here and still never
// actually mark the order paid the legitimate way, or worse, the
// client-side write could be called directly with a forged/never-
// verified payload. Now:
//   1. the Razorpay signature is checked (unchanged logic)
//   2. the order is looked up by internalOrderId
//   3. the order's stored razorpay_order_id must match the one in this
//      request (prevents replaying a valid signature from a different,
//      possibly cheaper, order against this order)
//   4. only then is status flipped to 'paid', and only from 'pending'
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, internalOrderId } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !internalOrderId) {
      return NextResponse.json(
        { error: 'Missing required payment fields' },
        { status: 400 }
      );
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return NextResponse.json(
        { error: 'Razorpay key secret not configured' },
        { status: 500 }
      );
    }

    // Verify the signature: HMAC SHA256 of `razorpay_order_id|razorpay_payment_id` using key_secret
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json(
        { error: 'Payment signature verification failed' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();
    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, status, razorpay_order_id, total_amount')
      .eq('id', internalOrderId)
      .maybeSingle();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.razorpay_order_id !== razorpay_order_id) {
      return NextResponse.json(
        { error: 'Payment does not match this order' },
        { status: 400 }
      );
    }

    if (order.status !== 'pending') {
      // Already paid (or failed) — treat as idempotent success only if
      // already paid, otherwise refuse.
      if (order.status === 'paid') {
        return NextResponse.json({ success: true, verified: true });
      }
      return NextResponse.json({ error: `Order is ${order.status}` }, { status: 409 });
    }

    const { error: updateError } = await admin
      .from('orders')
      .update({
        status: 'paid',
        razorpay_payment_id,
        razorpay_signature,
      })
      .eq('id', internalOrderId)
      .eq('status', 'pending');

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 });
    }

    // Self-hosted blog conversion attribution — if this browser visited a
    // blog post in the last 30 minutes (see BlogViewTracker), credit this
    // sale to that post in blog_analytics_events. Best-effort: a failure
    // here must never block the actual order confirmation.
    try {
      const lastBlogSlug = cookies().get('last_blog_slug')?.value;
      if (lastBlogSlug) {
        await admin.from('blog_analytics_events').insert({
          blog_slug: lastBlogSlug,
          event_type: 'conversion',
          amount: order.total_amount,
        });
      }
    } catch {
      // non-fatal — order is already confirmed above
    }

    return NextResponse.json({ success: true, verified: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Verification failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
