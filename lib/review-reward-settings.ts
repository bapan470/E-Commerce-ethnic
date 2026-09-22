// ---------------------------------------------------------------------
// Settings for the guest review-reward flow: whether a >=minStars
// rating submitted through app/review/[token] auto-issues a one-time
// discount coupon, and what that coupon looks like. Stored in the
// `settings` table under key 'review_reward_settings', locked to
// service_role only (see migration 20261002000000_guest_review_reward_flow.sql)
// -- same posture as cart_recovery_sequence_settings -- so this is read
// and written exclusively through app/api/admin/review-reward-settings
// (admin-token gated), never directly from a client component with the
// anon key.
// ---------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ReviewRewardSettings {
  /** Master on/off switch for auto-issuing a reward coupon at all. */
  enabled: boolean;
  /** Minimum star rating (1-5) required to earn a reward. Default 4. */
  minStars: number;
  discountType: 'percentage' | 'flat';
  discountValue: number;
  /** How many days the auto-issued coupon stays valid after issue. */
  expiryDays: number;
  /** Minimum order value (in the store's smallest currency unit, same
   *  as coupons.min_order_value elsewhere) required to redeem it. */
  minOrderValue: number;
}

export const DEFAULT_REVIEW_REWARD_SETTINGS: ReviewRewardSettings = {
  enabled: true,
  minStars: 4,
  discountType: 'percentage',
  discountValue: 10,
  expiryDays: 30,
  minOrderValue: 0,
};

export function mergeReviewRewardSettings(
  value: Partial<ReviewRewardSettings> | null | undefined
): ReviewRewardSettings {
  const merged = { ...DEFAULT_REVIEW_REWARD_SETTINGS, ...(value || {}) };
  // Clamp to sane bounds so a bad admin input can never produce a
  // nonsensical or abusable coupon (e.g. 0-star trigger, >100% off).
  merged.minStars = Math.min(5, Math.max(1, Math.round(merged.minStars)));
  merged.discountValue =
    merged.discountType === 'percentage'
      ? Math.min(90, Math.max(1, merged.discountValue))
      : Math.max(1, merged.discountValue);
  merged.expiryDays = Math.max(1, Math.round(merged.expiryDays));
  merged.minOrderValue = Math.max(0, merged.minOrderValue);
  return merged;
}

export async function getReviewRewardSettings(
  supabase: SupabaseClient
): Promise<ReviewRewardSettings> {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'review_reward_settings')
    .maybeSingle();
  return mergeReviewRewardSettings(data?.value as Partial<ReviewRewardSettings> | undefined);
}

export async function saveReviewRewardSettings(
  supabase: SupabaseClient,
  settings: ReviewRewardSettings
): Promise<ReviewRewardSettings> {
  const merged = mergeReviewRewardSettings(settings);
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'review_reward_settings', value: merged }, { onConflict: 'key' });
  if (error) throw error;
  return merged;
}
