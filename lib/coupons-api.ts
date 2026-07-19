import { supabase } from './supabase';

export interface Coupon {
  id: string;
  code: string;
  discount_type: 'percentage' | 'flat';
  discount_value: number;
  min_order_value: number;
  usage_limit: number | null;
  times_used: number;
  expires_at: string | null;
  is_active: boolean;
  show_on_product_page: boolean;
  created_at?: string;
}

export interface CouponResult {
  ok: boolean;
  error?: string;
  coupon?: Coupon;
  discount?: number;
}

// ---------------------------------------------------------------------
// Admin management (Admin > Coupons tab)
// ---------------------------------------------------------------------

export async function fetchCoupons(): Promise<Coupon[]> {
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Coupon[];
}

export interface CouponInput {
  code: string;
  discount_type: 'percentage' | 'flat';
  discount_value: number;
  min_order_value: number;
  usage_limit: number | null;
  expires_at: string | null;
  is_active: boolean;
  show_on_product_page: boolean;
}

export async function createCoupon(input: CouponInput) {
  const { error } = await supabase.from('coupons').insert({
    ...input,
    code: input.code.trim().toUpperCase(),
  });
  if (error) throw error;
}

export async function updateCoupon(id: string, input: CouponInput) {
  const { error } = await supabase
    .from('coupons')
    .update({ ...input, code: input.code.trim().toUpperCase() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteCoupon(id: string) {
  const { error } = await supabase.from('coupons').delete().eq('id', id);
  if (error) throw error;
}

export async function setCouponActive(id: string, is_active: boolean) {
  const { error } = await supabase.from('coupons').update({ is_active }).eq('id', id);
  if (error) throw error;
}

export async function setCouponShowOnProductPage(id: string, show_on_product_page: boolean) {
  const { error } = await supabase
    .from('coupons')
    .update({ show_on_product_page })
    .eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Storefront display (product page "Available Coupons" list)
// ---------------------------------------------------------------------

/**
 * Coupons an admin has flagged to show on the product page. Only
 * returns ones that are active, flagged visible, not expired, and
 * (if they have a usage limit) not yet exhausted.
 */
export async function fetchProductPageCoupons(): Promise<Coupon[]> {
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('is_active', true)
    .eq('show_on_product_page', true)
    .order('discount_value', { ascending: false });
  if (error) throw error;

  const now = Date.now();
  return ((data ?? []) as Coupon[]).filter(
    (c) =>
      (!c.expires_at || new Date(c.expires_at).getTime() > now) &&
      (c.usage_limit === null || c.times_used < c.usage_limit)
  );
}

// ---------------------------------------------------------------------
// Storefront validation (checkout page)
// ---------------------------------------------------------------------

/**
 * Looks up a coupon code and checks it against the current cart subtotal.
 * Returns the rupee discount to apply (already clamped to the subtotal so
 * a coupon can never take a total below zero).
 */
export async function validateCoupon(code: string, subtotal: number): Promise<CouponResult> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return { ok: false, error: 'Enter a coupon code' };

  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .ilike('code', trimmed)
    .maybeSingle();

  if (error) return { ok: false, error: 'Could not validate coupon right now' };
  if (!data) return { ok: false, error: 'Invalid coupon code' };

  const coupon = data as Coupon;

  if (!coupon.is_active) return { ok: false, error: 'This coupon is no longer active' };
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
    return { ok: false, error: 'This coupon has expired' };
  }
  if (coupon.usage_limit !== null && coupon.times_used >= coupon.usage_limit) {
    return { ok: false, error: 'This coupon has reached its usage limit' };
  }
  if (subtotal < coupon.min_order_value) {
    return {
      ok: false,
      error: `Add items worth ${coupon.min_order_value - subtotal} more to use this coupon`,
    };
  }

  const rawDiscount =
    coupon.discount_type === 'percentage'
      ? Math.round((subtotal * coupon.discount_value) / 100)
      : Math.round(coupon.discount_value);

  const discount = Math.min(rawDiscount, subtotal);

  return { ok: true, coupon, discount };
}
