// ---------------------------------------------------------------------
// Settings for the cart-recovery email SEQUENCE (up to 3 emails per
// abandoned cart instead of the old single one-off email). Stored in
// the `settings` table under key 'cart_recovery_sequence_settings',
// locked to service_role only (see migration
// 20260928010000_cart_recovery_sequence.sql) -- so unlike
// email-automation-api.ts this is read/written exclusively through
// app/api/admin/cart-recovery-settings (admin-token gated), never
// directly from a client component with the anon key.
//
// delay_hours meaning per step:
//   step 1: hours since the cart's last_activity_at (same trigger the
//           single-email version always used)
//   step 2 & 3: hours since the PREVIOUS email in the sequence was sent
// ---------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';

export interface CartRecoveryEmailStep {
  enabled: boolean;
  delay_hours: number;
  // Leave subject/html blank to use the built-in template for that
  // step (with escalating copy — soft nudge, reminder, last chance).
  // See renderCartRecoveryEmail() in lib/email-templates.ts for the
  // {{merge_fields}} available when writing a custom one.
  subject: string;
  html: string;
  coupon_code: string;
}

export interface CartRecoverySequenceSettings {
  enabled: boolean;
  steps: [CartRecoveryEmailStep, CartRecoveryEmailStep, CartRecoveryEmailStep];
}

const emptyStep = (delay_hours: number): CartRecoveryEmailStep => ({
  enabled: true,
  delay_hours,
  subject: '',
  html: '',
  coupon_code: '',
});

export const DEFAULT_CART_RECOVERY_SEQUENCE_SETTINGS: CartRecoverySequenceSettings = {
  enabled: true,
  steps: [emptyStep(1), emptyStep(24), emptyStep(72)],
};

export function mergeCartRecoverySequenceSettings(
  value: Partial<CartRecoverySequenceSettings> | null | undefined
): CartRecoverySequenceSettings {
  const steps = [0, 1, 2].map((i) => ({
    ...DEFAULT_CART_RECOVERY_SEQUENCE_SETTINGS.steps[i],
    ...(value?.steps?.[i] || {}),
  })) as CartRecoverySequenceSettings['steps'];
  return { enabled: value?.enabled ?? true, steps };
}

export async function getCartRecoverySequenceSettings(
  supabase: SupabaseClient
): Promise<CartRecoverySequenceSettings> {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'cart_recovery_sequence_settings')
    .maybeSingle();
  return mergeCartRecoverySequenceSettings(data?.value as Partial<CartRecoverySequenceSettings> | undefined);
}
