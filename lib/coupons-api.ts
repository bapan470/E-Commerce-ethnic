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
}

export interface CouponResult {
  ok: boolean;
  error?: string;
  coupon?: Coupon;
  discount?: number;
}

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
