import { getSupabaseBrowser } from './supabase-browser';

export interface Review {
  id: string;
  product_id: string;
  user_id: string | null;
  customer_name: string;
  rating: number;
  title: string | null;
  comment: string | null;
  is_approved: boolean;
  created_at: string;
}

export interface RatingSummary {
  average: number;
  total: number;
  breakdown: Record<1 | 2 | 3 | 4 | 5, number>;
}

export function summarizeReviews(reviews: Review[]): RatingSummary {
  const breakdown: RatingSummary['breakdown'] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of reviews) {
    breakdown[r.rating as 1 | 2 | 3 | 4 | 5] = (breakdown[r.rating as 1 | 2 | 3 | 4 | 5] || 0) + 1;
  }
  const total = reviews.length;
  const average =
    total === 0 ? 0 : reviews.reduce((sum, r) => sum + r.rating, 0) / total;
  return { average: Math.round(average * 10) / 10, total, breakdown };
}

/** Approved reviews for a product, newest first. Public — no auth required. */
export async function fetchApprovedReviews(productId: string): Promise<Review[]> {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('product_id', productId)
    .eq('is_approved', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Review[];
}

/** Has the current logged-in user already reviewed this product? */
export async function fetchMyReviewForProduct(productId: string): Promise<Review | null> {
  const supabase = getSupabaseBrowser();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('product_id', productId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return (data as Review) ?? null;
}

export interface AdminReview extends Review {
  product_name: string;
  product_slug: string;
}

/**
 * Admin: every review regardless of approval status, newest first,
 * with the parent product's name/slug joined in for display.
 */
export async function fetchAllReviewsAdmin(): Promise<AdminReview[]> {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from('reviews')
    .select('*, products(name, slug)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => {
    const { products: product, ...review } = row;
    return {
      ...review,
      product_name: product?.name ?? 'Deleted product',
      product_slug: product?.slug ?? '',
    } as AdminReview;
  });
}

export async function approveReview(id: string): Promise<void> {
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.from('reviews').update({ is_approved: true }).eq('id', id);
  if (error) throw error;
}

/** Reject/unpublish — keeps the review row (and its author) but hides it storefront-side. */
export async function unapproveReview(id: string): Promise<void> {
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.from('reviews').update({ is_approved: false }).eq('id', id);
  if (error) throw error;
}

export async function deleteReviewAdmin(id: string): Promise<void> {
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.from('reviews').delete().eq('id', id);
  if (error) throw error;
}

/** Only customers who purchased the product (delivered order) may review it. */
export async function hasPurchasedProduct(productId: string): Promise<boolean> {
  const supabase = getSupabaseBrowser();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from('order_items')
    .select('id, orders!inner(user_id, status)')
    .eq('product_id', productId)
    .eq('orders.user_id', user.id);
  if (error) return false;
  return (data ?? []).length > 0;
}

export async function submitReview(input: {
  productId: string;
  rating: number;
  title?: string;
  comment?: string;
}): Promise<Review> {
  const supabase = getSupabaseBrowser();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Please login to write a review');

  const customerName =
    (user.user_metadata?.full_name as string | undefined) ||
    user.email?.split('@')[0] ||
    'Customer';

  const { data, error } = await supabase
    .from('reviews')
    .insert({
      product_id: input.productId,
      user_id: user.id,
      customer_name: customerName,
      rating: input.rating,
      title: input.title || null,
      comment: input.comment || null,
      is_approved: false,
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('You have already reviewed this product');
    }
    throw error;
  }
  return data as Review;
}
