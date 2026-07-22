import { supabase } from './supabase';

export interface StoreInfo {
  name: string;
  address: string;
  gstin: string;
  support_email: string;
  support_phone: string;
  whatsapp_number?: string;
}

const DEFAULT_STORE_INFO: StoreInfo = {
  name: 'Aruhi Handlooms',
  address: '',
  gstin: '',
  support_email: '',
  support_phone: '',
  whatsapp_number: '',
};

export async function fetchStoreInfo(): Promise<StoreInfo> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'store_info')
    .maybeSingle();
  if (error || !data) return DEFAULT_STORE_INFO;
  return { ...DEFAULT_STORE_INFO, ...(data.value as Partial<StoreInfo>) };
}

export async function saveStoreInfo(info: StoreInfo) {
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'store_info', value: info }, { onConflict: 'key' });
  if (error) throw error;
}

export interface SiteBanner {
  image_url: string;
  link_url?: string;
}

const DEFAULT_SITE_BANNER: SiteBanner = {
  image_url: '',
  link_url: '',
};

export async function fetchSiteBanner(): Promise<SiteBanner> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'site_banner')
    .maybeSingle();
  if (error || !data) return DEFAULT_SITE_BANNER;
  return { ...DEFAULT_SITE_BANNER, ...(data.value as Partial<SiteBanner>) };
}

export async function saveSiteBanner(banner: SiteBanner) {
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'site_banner', value: banner }, { onConflict: 'key' });
  if (error) throw error;
}

export type EmailProvider = 'resend' | 'zeptomail' | '';

export interface EmailSettings {
  provider: EmailProvider;
  api_key: string;
  sender_email: string;
  sender_name: string;
  // ZeptoMail is hosted regionally — India (.in) vs global (.com) accounts
  // use different API base URLs. Ignored by Resend.
  zeptomail_region: 'in' | 'com';
}

const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  provider: '',
  api_key: '',
  sender_email: '',
  sender_name: 'Aruhi Handlooms',
  zeptomail_region: 'in',
};

export async function fetchEmailSettings(): Promise<EmailSettings> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'email_provider')
    .maybeSingle();
  if (error || !data) return DEFAULT_EMAIL_SETTINGS;
  return { ...DEFAULT_EMAIL_SETTINGS, ...(data.value as Partial<EmailSettings>) };
}

export async function saveEmailSettings(settings: EmailSettings) {
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'email_provider', value: settings }, { onConflict: 'key' });
  if (error) throw error;
}

// Models this project has confirmed working against the free NVIDIA
// NIM API key that also powers Admin > Products > "Generate with AI".
// Swap here any time NVIDIA enables/retires a model on your account —
// no redeploy needed.
export const AI_CHAT_MODEL_OPTIONS = [
  { value: 'meta/llama-3.3-70b-instruct', label: 'Llama 3.3 70B Instruct (recommended)' },
  { value: 'meta/llama-3.1-70b-instruct', label: 'Llama 3.1 70B Instruct' },
  { value: 'meta/llama-3.2-90b-vision-instruct', label: 'Llama 3.2 90B Vision Instruct' },
  { value: 'mistralai/mixtral-8x22b-instruct-v0.1', label: 'Mixtral 8x22B Instruct' },
  { value: 'qwen/qwen2.5-7b-instruct', label: 'Qwen 2.5 7B Instruct (fastest)' },
] as const;

export interface AiChatSettings {
  enabled: boolean;
  primary_model: string;
  fallback_model: string;
}

export const DEFAULT_AI_CHAT_SETTINGS: AiChatSettings = {
  enabled: true,
  primary_model: 'meta/llama-3.3-70b-instruct',
  fallback_model: 'meta/llama-3.2-90b-vision-instruct',
};

export async function fetchAiChatSettings(): Promise<AiChatSettings> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'ai_chat')
    .maybeSingle();
  if (error || !data) return DEFAULT_AI_CHAT_SETTINGS;
  return { ...DEFAULT_AI_CHAT_SETTINGS, ...(data.value as Partial<AiChatSettings>) };
}

export async function saveAiChatSettings(settings: AiChatSettings) {
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'ai_chat', value: settings }, { onConflict: 'key' });
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Phase 4A — vendor handling-fee formula + settlement config.
// fee = handling_fee_base + (sale_price * handling_fee_percent / 100),
// applied by the DB trigger calculate_order_item_settlement_fee()
// (supabase/migrations/20260808000000_phase4a_settlement_schema.sql)
// the moment an order_item's stage becomes 'delivered'. This
// fetch/save pair is provided now so Phase 4B's admin settings screen
// just needs to build a form around it — no new plumbing.
// ---------------------------------------------------------------------
export interface HandlingFeeSettings {
  handling_fee_base: number;
  handling_fee_percent: number;
  return_window_days: number;
}

const DEFAULT_HANDLING_FEE_SETTINGS: HandlingFeeSettings = {
  handling_fee_base: 0,
  handling_fee_percent: 10,
  return_window_days: 7,
};

export async function fetchHandlingFeeSettings(): Promise<HandlingFeeSettings> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'vendor_settlement_settings')
    .maybeSingle();
  if (error || !data) return DEFAULT_HANDLING_FEE_SETTINGS;
  return { ...DEFAULT_HANDLING_FEE_SETTINGS, ...(data.value as Partial<HandlingFeeSettings>) };
}

export async function saveHandlingFeeSettings(settings: HandlingFeeSettings) {
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'vendor_settlement_settings', value: settings }, { onConflict: 'key' });
  if (error) throw error;
}

/** Mirrors the DB trigger's math client-side, e.g. for an admin preview before saving new fee settings. */
export function calculateHandlingFee(salePrice: number, settings: HandlingFeeSettings): number {
  const fee = settings.handling_fee_base + (salePrice * settings.handling_fee_percent) / 100;
  return Math.min(Math.round(fee * 100) / 100, salePrice);
}

/**
 * Server-only variant (used inside API routes where we don't have a
 * browser session). Importing the client `supabase` singleton from a
 * route handler works fine at runtime, but this keeps the pattern
 * consistent with delhivery-api.ts / other server-side settings reads
 * and avoids depending on a 'use client' module from server code.
 */
export async function fetchAiChatSettingsServer(): Promise<AiChatSettings> {
  const { getServerSupabase } = await import('./supabase-server');
  const serverSupabase = getServerSupabase();
  const { data, error } = await serverSupabase
    .from('settings')
    .select('value')
    .eq('key', 'ai_chat')
    .maybeSingle();
  if (error || !data) return DEFAULT_AI_CHAT_SETTINGS;
  return { ...DEFAULT_AI_CHAT_SETTINGS, ...(data.value as Partial<AiChatSettings>) };
}
