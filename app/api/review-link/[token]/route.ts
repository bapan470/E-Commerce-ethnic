import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { verifyReviewToken } from '@/lib/review-link-tokens';
import { issueReviewReward } from '@/lib/review-rewards-server';

// ---------------------------------------------------------------------
// Public, login-free review flow behind a secret per-order token (see
// lib/review-link-tokens.ts). Backs app/review/[token]/page.tsx.
//
//   GET  -> order summary (items + which ones are already reviewed)
//   POST -> submit a rating/review/photos for one item in the order,
//           auto-issuing a discount coupon when the rating qualifies
//           (see lib/review-rewards-server.ts)
//
// Nothing here trusts the caller's identity beyond "knows the token" --
// the same trust level as a password-reset link. All writes go through
// getSupabaseAdmin() (service role), which is what makes the
// login-gated `auth_insert_reviews` RLS policy irrelevant here: this
// route IS the authorization check.
// ---------------------------------------------------------------------

interface OrderItem {
  product_id?: string;
  product_name?: string;
  name?: string;
  image_url?: string;
  image?: string;
  images?: string[];
  size?: string;
  slug?: string;
  quantity?: number;
  price?: number;
}

async function loadOrder(orderId: string) {
  const supabase = getSupabaseAdmin();
  const { data: order, error } = await supabase
    .from('orders')
    .select('id, items, status, customer_name, customer_email, created_at')
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw error;
  return order;
}

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  try {
    const verified = await verifyReviewToken(params.token);
    if (!verified) {
      return NextResponse.json({ error: 'This review link is invalid or has expired.' }, { status: 404 });
    }

    const order = await loadOrder(verified.orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    const items: OrderItem[] = Array.isArray(order.items) ? order.items : [];
    const productIds = Array.from(new Set(items.map((it) => it.product_id).filter(Boolean))) as string[];

    const supabase = getSupabaseAdmin();
    const { data: existingReviews, error: reviewsError } = await supabase
      .from('reviews')
      .select('id, product_id, rating, title, comment, photos, is_approved')
      .eq('order_id', order.id)
      .in('product_id', productIds.length ? productIds : ['00000000-0000-0000-0000-000000000000']);
    if (reviewsError) throw reviewsError;

    const reviewedByProduct = new Map((existingReviews ?? []).map((r) => [r.product_id, r]));

    return NextResponse.json({
      order: {
        id: order.id,
        shortId: order.id.slice(0, 8).toUpperCase(),
        customerName: order.customer_name,
      },
      items: items.map((it) => ({
        productId: it.product_id ?? null,
        name: it.product_name || it.name || 'Item',
        image: it.image_url || it.image || it.images?.[0] || null,
        size: it.size || null,
        slug: it.slug || null,
        existingReview: it.product_id ? reviewedByProduct.get(it.product_id) ?? null : null,
      })),
    });
  } catch (err) {
    console.error('[review-link GET] error:', err);
    return NextResponse.json({ error: 'Could not load this order right now.' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  try {
    const verified = await verifyReviewToken(params.token);
    if (!verified) {
      return NextResponse.json({ error: 'This review link is invalid or has expired.' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const { productId, rating, title, comment, photos, guestEmail } = body || {};

    const parsedRating = Number(rating);
    if (!productId || !Number.isFinite(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return NextResponse.json({ error: 'A product and a 1-5 star rating are required.' }, { status: 400 });
    }

    const order = await loadOrder(verified.orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    const items: OrderItem[] = Array.isArray(order.items) ? order.items : [];
    const item = items.find((it) => it.product_id === productId);
    if (!item) {
      return NextResponse.json({ error: 'This product is not part of this order.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // One review per (order, product) through this flow -- matches the
    // review_rewards UNIQUE constraint's granularity, and stops someone
    // reloading the page from creating duplicate reviews for the same
    // item.
    const { data: alreadyReviewed } = await supabase
      .from('reviews')
      .select('id')
      .eq('order_id', order.id)
      .eq('product_id', productId)
      .maybeSingle();
    if (alreadyReviewed) {
      return NextResponse.json({ error: 'You have already reviewed this item.' }, { status: 409 });
    }

    const customerName = order.customer_name || (guestEmail ? String(guestEmail).split('@')[0] : 'Customer');

    const { data: review, error: insertError } = await supabase
      .from('reviews')
      .insert({
        product_id: productId,
        order_id: order.id,
        guest_email: guestEmail || order.customer_email || null,
        customer_name: customerName,
        rating: parsedRating,
        title: title || null,
        comment: comment || null,
        photos: Array.isArray(photos) ? photos.slice(0, 4) : [],
        is_approved: false,
        verified_purchase: true,
      })
      .select('*')
      .single();
    if (insertError) throw insertError;

    let reward = null;
    try {
      reward = await issueReviewReward({
        orderId: order.id,
        productId,
        reviewId: review.id,
        rating: parsedRating,
      });
    } catch (rewardErr) {
      // A reward failure should never lose the review the customer just
      // submitted -- log it and still return success for the review.
      console.error('[review-link POST] reward issue failed:', rewardErr);
    }

    return NextResponse.json({ review, reward });
  } catch (err) {
    console.error('[review-link POST] error:', err);
    return NextResponse.json({ error: 'Could not submit your review right now.' }, { status: 500 });
  }
}
