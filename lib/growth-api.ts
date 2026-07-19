import { supabase } from './supabase';

// ---------------------------------------------------------------------
// Phase 13 — Growth Marketing Toolkit
// Conversion-focused, admin-toggleable features: urgency banner, low
// stock badges, exit-intent discount popup, live social proof toasts,
// and a sale countdown bar. All settings live in one row so the admin
// can flip any of them on/off from Admin > Marketing > Growth Tools
// without a redeploy.
// ---------------------------------------------------------------------

export interface GrowthSettings {
  urgency_banner_enabled: boolean;
  urgency_banner_text: string;

  low_stock_enabled: boolean;
  low_stock_threshold: number;

  exit_intent_enabled: boolean;
  exit_intent_headline: string;
  exit_intent_message: string;
  exit_intent_coupon_code: string;

  social_proof_enabled: boolean;

  bundles_enabled: boolean;

  sale_countdown_enabled: boolean;
  sale_countdown_text: string;
  sale_countdown_end_at: string | null; // ISO timestamp
}

export const DEFAULT_GROWTH_SETTINGS: GrowthSettings = {
  urgency_banner_enabled: false,
  urgency_banner_text: 'Free shipping on orders above ₹1999 — today only!',
  low_stock_enabled: true,
  low_stock_threshold: 5,
  exit_intent_enabled: false,
  exit_intent_headline: "Wait! Don't leave empty-handed",
  exit_intent_message: "Here's 10% off your first order, just for you.",
  exit_intent_coupon_code: 'WELCOME10',
  social_proof_enabled: false,
  bundles_enabled: true,
  sale_countdown_enabled: false,
  sale_countdown_text: 'Festive Sale ends in',
  sale_countdown_end_at: null,
};

export async function fetchGrowthSettings(): Promise<GrowthSettings> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'growth_settings')
    .maybeSingle();
  if (error || !data) return DEFAULT_GROWTH_SETTINGS;
  return { ...DEFAULT_GROWTH_SETTINGS, ...(data.value as Partial<GrowthSettings>) };
}

export async function saveGrowthSettings(settings: GrowthSettings) {
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'growth_settings', value: settings }, { onConflict: 'key' });
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Social proof feed — "Someone in Jaipur just bought X, 8 minutes ago"
// Reads straight off recent order_items, no new table needed.
// ---------------------------------------------------------------------

export interface SocialProofEvent {
  product_name: string;
  city: string | null;
  minutes_ago: number;
}

export async function fetchSocialProofFeed(): Promise<SocialProofEvent[]> {
  const res = await fetch('/api/social-proof');
  if (!res.ok) return [];
  const body = await res.json().catch(() => ({ events: [] }));
  return (body.events ?? []) as SocialProofEvent[];
}
