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
  name: 'AruhiHandlooms',
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

// ---------------------------------------------------------------------
// About Us page content — the story/values/process text on /about.
// Business identity fields (address, GSTIN, email, phone) stay in
// StoreInfo above and are reused on /about automatically; this only
// covers the narrative copy so admins can edit it without touching code.
// ---------------------------------------------------------------------
export interface AboutContentBlock {
  title: string;
  body: string;
}

export interface AboutContent {
  hero_heading: string;
  hero_subtext: string;
  story_paragraph_1: string;
  story_paragraph_2: string;
  values: AboutContentBlock[]; // exactly 4 — icons are fixed in code, matched by position
  process_steps: AboutContentBlock[]; // exactly 4 — icons/step numbers fixed in code
}

export const DEFAULT_ABOUT_CONTENT: AboutContent = {
  hero_heading:
    "Handwoven ethnic wear, sold the way it's made — by hand, and by name.",
  hero_subtext:
    'AruhiHandlooms sources sarees, lehengas and bridal wear directly from handloom weaving clusters across India, and sells them online with the same care they were woven with.',
  story_paragraph_1:
    "Handloom weaving is slow, skilled work, and it rarely gets sold that way online — pieces pass through several hands before reaching a customer, with little said about who actually wove them. AruhiHandlooms was built to shorten that distance: we work with weavers directly, list what's actually in stock, and stand behind every order with a real support team and real policies.",
  story_paragraph_2:
    "We're not a print-on-demand storefront or a drop-shipped catalogue. What you see listed is what our team has checked, photographed and can ship — and if something isn't right, our refund policy and support team are there to fix it.",
  values: [
    {
      title: 'Handwoven, not mass-produced',
      body: 'Every saree and set is woven on a loom by hand. Small irregularities in weave and color are marks of handwork, not defects.',
    },
    {
      title: 'Sourced directly from weavers',
      body: 'We work with weaving clusters across India instead of routing through multiple middlemen, so quality and pricing stay traceable.',
    },
    {
      title: 'Natural fibres first',
      body: 'Silk, cotton, mulmul and cotton-silk blends are chosen for how they wear and drape, not just how they photograph.',
    },
    {
      title: 'Accountable after the sale',
      body: 'Real order, shipping and refund policies apply to every purchase — see our support details below if anything needs sorting out.',
    },
  ],
  process_steps: [
    {
      title: 'Yarn & design',
      body: 'Yarn is selected and a weave design is set before a single thread goes on the loom.',
    },
    {
      title: 'Handloom weaving',
      body: 'Artisans weave each piece by hand, which is why timelines vary and no two pieces are perfectly identical.',
    },
    {
      title: 'Quality check',
      body: 'Every piece is checked for weave, finish and stitching before it is listed as ready to ship.',
    },
    {
      title: 'Packed & shipped',
      body: 'Orders are packed and handed to our courier partners with tracking shared on your account.',
    },
  ],
};

export function mergeAboutContent(value: Partial<AboutContent> | null | undefined): AboutContent {
  const v = value || {};
  return {
    ...DEFAULT_ABOUT_CONTENT,
    ...v,
    values:
      Array.isArray(v.values) && v.values.length === 4
        ? v.values
        : DEFAULT_ABOUT_CONTENT.values,
    process_steps:
      Array.isArray(v.process_steps) && v.process_steps.length === 4
        ? v.process_steps
        : DEFAULT_ABOUT_CONTENT.process_steps,
  };
}

export async function fetchAboutContent(): Promise<AboutContent> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'about_content')
    .maybeSingle();
  if (error || !data) return DEFAULT_ABOUT_CONTENT;
  return mergeAboutContent(data.value as Partial<AboutContent>);
}

export async function saveAboutContent(content: AboutContent) {
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'about_content', value: content }, { onConflict: 'key' });
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Social media links — shown as icons in the storefront footer.
// Any field left blank is simply hidden on the footer, so admins don't
// have to fill in every platform.
// ---------------------------------------------------------------------
export interface SocialLinks {
  instagram: string;
  facebook: string;
  youtube: string;
  twitter: string;
  linkedin: string;
  whatsapp: string; // full wa.me link or number, e.g. https://wa.me/918001234567
}

const DEFAULT_SOCIAL_LINKS: SocialLinks = {
  instagram: '',
  facebook: '',
  youtube: '',
  twitter: '',
  linkedin: '',
  whatsapp: '',
};

export async function fetchSocialLinks(): Promise<SocialLinks> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'social_links')
    .maybeSingle();
  if (error || !data) return DEFAULT_SOCIAL_LINKS;
  return { ...DEFAULT_SOCIAL_LINKS, ...(data.value as Partial<SocialLinks>) };
}

export async function saveSocialLinks(links: SocialLinks) {
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'social_links', value: links }, { onConflict: 'key' });
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Online payment discount — an extra % off applied at checkout when the
// customer pays online (via the payment gateway) instead of COD. Shown as
// a consistent incentive card on the product page, the cart drawer, and
// the full cart page, and actually applied to the order total in
// checkout once "Pay online" is selected.
//
// The `label` should describe the payment methods that actually qualify
// (e.g. "UPI / Cards / Netbanking" or just "UPI" if that's the only
// qualifying method) rather than naming the payment gateway/processor
// itself — naming the processor implies it is the one offering the
// discount, which it isn't, and risks misrepresentation.
//
// Deliberately NOT submitted to Google Merchant Center as a structured
// "Promotion" or baked into the product feed / JSON-LD price: Merchant
// Center's Promotions policy treats discounts restricted to a specific
// payment method as an "overly restrictive" promotion outside Brazil, and
// the [price] attribute must always reflect the standard (non-conditional)
// price. This stays a checkout-time, on-site incentive only — the feed
// price and structured data keep showing the normal price.
// ---------------------------------------------------------------------
export interface PaymentDiscountSettings {
  enabled: boolean;
  /** Extra discount percentage applied to the order subtotal when paying online (0-100). */
  percent: number;
  /** Short customer-facing label, e.g. "online payment" — used in "Get X% off on {label}". */
  label: string;
}

export const DEFAULT_PAYMENT_DISCOUNT_SETTINGS: PaymentDiscountSettings = {
  enabled: false,
  percent: 5,
  label: 'online payment',
};

export async function fetchPaymentDiscountSettings(): Promise<PaymentDiscountSettings> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'payment_discount')
    .maybeSingle();
  if (error || !data) return DEFAULT_PAYMENT_DISCOUNT_SETTINGS;
  return { ...DEFAULT_PAYMENT_DISCOUNT_SETTINGS, ...(data.value as Partial<PaymentDiscountSettings>) };
}

export async function savePaymentDiscountSettings(settings: PaymentDiscountSettings) {
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'payment_discount', value: settings }, { onConflict: 'key' });
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Refund automation — controls whether a customer self-cancelling a
// paid-online order gets an automatic Razorpay refund (see
// app/api/orders/[id]/cancel/route.ts), or whether it's left for the
// admin to process by hand from the Razorpay dashboard/orders panel.
// ---------------------------------------------------------------------
export interface RefundAutomationSettings {
  auto_refund_enabled: boolean;
}

export const DEFAULT_REFUND_AUTOMATION_SETTINGS: RefundAutomationSettings = {
  auto_refund_enabled: true,
};

export async function fetchRefundAutomationSettings(): Promise<RefundAutomationSettings> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'refund_automation')
    .maybeSingle();
  if (error || !data) return DEFAULT_REFUND_AUTOMATION_SETTINGS;
  return { ...DEFAULT_REFUND_AUTOMATION_SETTINGS, ...(data.value as Partial<RefundAutomationSettings>) };
}

export async function saveRefundAutomationSettings(settings: RefundAutomationSettings) {
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'refund_automation', value: settings }, { onConflict: 'key' });
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Return automation — single master toggle for the whole return flow:
// 'automatic' auto-schedules the Delhivery reverse pickup as soon as an
// admin approves a return, and auto-fires the Razorpay refund once
// Delhivery shows the item back at the warehouse. 'manual' leaves both
// steps to be triggered by hand from Admin -> Returns.
// ---------------------------------------------------------------------
export interface ReturnAutomationSettings {
  mode: 'automatic' | 'manual';
}

export const DEFAULT_RETURN_AUTOMATION_SETTINGS: ReturnAutomationSettings = {
  mode: 'automatic',
};

export async function fetchReturnAutomationSettings(): Promise<ReturnAutomationSettings> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'return_automation')
    .maybeSingle();
  if (error || !data) return DEFAULT_RETURN_AUTOMATION_SETTINGS;
  const value = (data.value as Partial<ReturnAutomationSettings>) || {};
  return {
    ...DEFAULT_RETURN_AUTOMATION_SETTINGS,
    ...value,
    mode: value.mode === 'manual' ? 'manual' : 'automatic',
  };
}

export async function saveReturnAutomationSettings(settings: ReturnAutomationSettings) {
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'return_automation', value: settings }, { onConflict: 'key' });
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

// ---------------------------------------------------------------------
// Social auto-publish (Facebook Page + Instagram) — Admin > Marketing >
// Social Auto-Post. When enabled, every product that goes live — vendor-
// submitted (after AI processing) or admin-added directly — is
// automatically posted. The actual Graph API calls happen server-only in
// lib/social-publish-api.ts (which stays out of the client bundle); this
// is deliberately a plain local type/default, not imported from there,
// so this settings form can stay a normal client-side module.
// ---------------------------------------------------------------------
export interface SocialPublishSettings {
  facebook_enabled: boolean;
  instagram_enabled: boolean;
  access_token: string;
  facebook_page_id: string;
  instagram_business_account_id: string;
  // Threads uses a completely separate Meta app/OAuth (graph.threads.net) —
  // its own access token and its own user id, not the Page token above.
  threads_enabled: boolean;
  threads_access_token: string;
  threads_user_id: string;
  caption_template: string;
}

const DEFAULT_SOCIAL_PUBLISH_SETTINGS: SocialPublishSettings = {
  facebook_enabled: false,
  instagram_enabled: false,
  access_token: '',
  facebook_page_id: '',
  instagram_business_account_id: '',
  threads_enabled: false,
  threads_access_token: '',
  threads_user_id: '',
  caption_template: '✨ New Arrival: {name}\n\n{description}\n\nPrice: ₹{price}\nShop now: {url}',
};

// fetchSocialPublishSettings()/saveSocialPublishSettings() were removed
// from here — this key holds live Facebook/Instagram/Threads access
// tokens and must never be read/written with the public anon key.
// Use app/api/admin/settings/social-publish (admin-token protected,
// service-role client) instead.

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
  sender_name: 'AruhiHandlooms',
  zeptomail_region: 'in',
};

// fetchEmailSettings()/saveEmailSettings() were removed from here —
// this key holds a live email-provider API key and must never be
// read/written with the public anon key. Use
// app/api/admin/settings/email (admin-token protected, service-role
// client) instead.

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

// ---------------------------------------------------------------------
// "Search by photo" AI toggle — controls whether the camera-icon search
// in the header uses the real NVIDIA vision model (app/api/image-search)
// to understand what's actually in the shopper's photo (garment type,
// colour, pattern), or falls back to the free, always-available
// client-side colour-fingerprint match in lib/image-search.ts. Same
// NVIDIA_API_KEY as AI Chat / admin listing generation — no extra key
// needed if that's already configured. Admins can flip this off instantly
// (e.g. if the free NVIDIA tier is rate-limited) without a redeploy;
// the feature keeps working either way, just with the simpler matching.
// ---------------------------------------------------------------------
export interface ImageSearchAiSettings {
  enabled: boolean;
}

export const DEFAULT_IMAGE_SEARCH_AI_SETTINGS: ImageSearchAiSettings = {
  enabled: false,
};

export async function fetchImageSearchAiSettings(): Promise<ImageSearchAiSettings> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'image_search_ai')
    .maybeSingle();
  if (error || !data) return DEFAULT_IMAGE_SEARCH_AI_SETTINGS;
  return { ...DEFAULT_IMAGE_SEARCH_AI_SETTINGS, ...(data.value as Partial<ImageSearchAiSettings>) };
}

export async function saveImageSearchAiSettings(settings: ImageSearchAiSettings) {
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'image_search_ai', value: settings }, { onConflict: 'key' });
  if (error) throw error;
}

/** Server-only variant, same rationale as fetchAiChatSettingsServer above. */
export async function fetchImageSearchAiSettingsServer(): Promise<ImageSearchAiSettings> {
  const { getServerSupabase } = await import('./supabase-server');
  const serverSupabase = getServerSupabase();
  const { data, error } = await serverSupabase
    .from('settings')
    .select('value')
    .eq('key', 'image_search_ai')
    .maybeSingle();
  if (error || !data) return DEFAULT_IMAGE_SEARCH_AI_SETTINGS;
  return { ...DEFAULT_IMAGE_SEARCH_AI_SETTINGS, ...(data.value as Partial<ImageSearchAiSettings>) };
}
