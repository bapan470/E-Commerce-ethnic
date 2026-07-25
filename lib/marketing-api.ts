import { getServerSupabase } from './supabase-server';

// NOTE: this file is imported from BOTH client components (admin panels,
// WhatsApp/trust-badge widgets, live chat) and server-only code (the
// Google Merchant feed route, the legal pages route, the AI chat route).
// It used to import the `supabase` singleton from './supabase', which is
// marked 'use client' -- that's fine from a Client Component, but Next.js
// throws "Cannot access supabase.from on the server. You cannot dot into
// a client module from a server component." the moment a Server
// Component / Route Handler touches it (this is what broke the
// /api/merchant-feed build). `getServerSupabase()` uses the exact same
// anon-key client config with no 'use client' boundary, so it works
// identically from both the browser and the server.
const supabase = getServerSupabase();

// ---------------------------------------------------------------------
// Fulfillment timing: dispatch window, delivery windows by zone, return
// window, and cancellation window.
//
// This is the SINGLE SOURCE OF TRUTH for every "dispatched in X days" /
// "X-day returns" / "cancel within X hours" claim across the storefront
// (product page, footer badges, checkout trust badges, legal pages, the
// live chat widget, order-return eligibility, and the Google Merchant
// Center feed). Change it once in Admin > Marketing > Shipping & Returns
// Timing and every one of those surfaces stays in sync automatically —
// which is exactly what keeps the on-site claims matching what's
// declared to Google Merchant Center and avoids a shipping/returns
// misrepresentation flag.
// ---------------------------------------------------------------------

export interface FulfillmentSettings {
  dispatch_days_min: number;
  dispatch_days_max: number;
  delivery_metro_min: number;
  delivery_metro_max: number;
  delivery_other_min: number;
  delivery_other_max: number;
  delivery_remote_min: number;
  delivery_remote_max: number;
  return_window_days: number;
  cancellation_window_hours: number;
}

export const DEFAULT_FULFILLMENT_SETTINGS: FulfillmentSettings = {
  dispatch_days_min: 2,
  dispatch_days_max: 3,
  delivery_metro_min: 3,
  delivery_metro_max: 5,
  delivery_other_min: 5,
  delivery_other_max: 8,
  delivery_remote_min: 10,
  delivery_remote_max: 12,
  return_window_days: 7,
  cancellation_window_hours: 12,
};

export async function fetchFulfillmentSettings(): Promise<FulfillmentSettings> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'fulfillment_settings')
    .maybeSingle();
  if (error || !data) return DEFAULT_FULFILLMENT_SETTINGS;
  return { ...DEFAULT_FULFILLMENT_SETTINGS, ...(data.value as Partial<FulfillmentSettings>) };
}

export async function saveFulfillmentSettings(settings: FulfillmentSettings) {
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'fulfillment_settings', value: settings }, { onConflict: 'key' });
  if (error) throw error;
}

function dayRange(min: number, max: number): string {
  return min === max ? `${min}` : `${min}-${max}`;
}

/** e.g. "2-3 business days" */
export function dispatchWindowText(f: FulfillmentSettings): string {
  return `${dayRange(f.dispatch_days_min, f.dispatch_days_max)} business days`;
}

/** e.g. "3-5 business days after dispatch" */
export function metroDeliveryText(f: FulfillmentSettings): string {
  return `${dayRange(f.delivery_metro_min, f.delivery_metro_max)} business days after dispatch`;
}

/** e.g. "5-8 business days after dispatch" */
export function otherDeliveryText(f: FulfillmentSettings): string {
  return `${dayRange(f.delivery_other_min, f.delivery_other_max)} business days after dispatch`;
}

/** e.g. "up to 10-12 business days" */
export function remoteDeliveryText(f: FulfillmentSettings): string {
  return `up to ${dayRange(f.delivery_remote_min, f.delivery_remote_max)} business days`;
}

/** e.g. "7-day" — for badges like "7-day Returns" */
export function returnWindowBadgeText(f: FulfillmentSettings): string {
  return `${f.return_window_days}-day`;
}

/** e.g. "7 days" — for sentences like "returns within 7 days" */
export function returnWindowText(f: FulfillmentSettings): string {
  return `${f.return_window_days} days`;
}

/** e.g. "12 hours" */
export function cancellationWindowText(f: FulfillmentSettings): string {
  return `${f.cancellation_window_hours} hours`;
}

/** Short one-line summary used on the product page's Shipping & Returns tab. */
export function shippingReturnsSummary(f: FulfillmentSettings, freeShippingThreshold?: number): string {
  const freeShip = freeShippingThreshold
    ? `Free shipping on all orders above Rs ${freeShippingThreshold.toLocaleString('en-IN')}. `
    : '';
  return `${freeShip}Dispatched within ${dispatchWindowText(f)}. ${returnWindowBadgeText(f)} easy returns on unworn items with original packaging.`;
}

// Tokens an admin can drop anywhere inside a Legal Page's text so that
// page always reflects the current numbers from Admin > Marketing >
// Shipping & Returns Timing, instead of typing numbers in as plain text
// that silently go stale the next time those settings change.
export function applyFulfillmentTokens(text: string, f: FulfillmentSettings): string {
  if (!text) return text;
  return text
    .replace(/\{\{\s*dispatch_days\s*\}\}/g, dayRange(f.dispatch_days_min, f.dispatch_days_max))
    .replace(/\{\{\s*metro_days\s*\}\}/g, dayRange(f.delivery_metro_min, f.delivery_metro_max))
    .replace(/\{\{\s*other_days\s*\}\}/g, dayRange(f.delivery_other_min, f.delivery_other_max))
    .replace(/\{\{\s*remote_days\s*\}\}/g, dayRange(f.delivery_remote_min, f.delivery_remote_max))
    .replace(/\{\{\s*return_days\s*\}\}/g, String(f.return_window_days))
    .replace(/\{\{\s*cancellation_hours\s*\}\}/g, String(f.cancellation_window_hours));
}

// Ready-to-paste templates — the admin panel's "Insert template" button on
// the Shipping Policy / Refund Policy fields drops this text in, already
// wired up with the tokens above, so future timing changes flow through
// without anyone touching this text again.
export const SHIPPING_POLICY_TEMPLATE = `Order Processing
Orders are processed and dispatched within {{dispatch_days}} business days of order confirmation, excluding Sundays and public holidays. During sale periods, processing may take slightly longer.

Delivery Timelines
Metro cities: {{metro_days}} business days after dispatch
Other cities/towns: {{other_days}} business days after dispatch
Remote/rural areas: may take up to {{remote_days}} business days

These are estimated timelines and may vary depending on courier partner delays, weather conditions, or other unforeseen circumstances.

Shipping Charges
Free shipping is available on eligible orders as shown at checkout. A flat shipping charge applies below that threshold.

Order Tracking
Once your order is dispatched, you will receive a tracking link via email/WhatsApp/SMS to track your shipment in real time.

Delivery Attempts
Our courier partners typically make up to 2-3 delivery attempts. If delivery is unsuccessful, the order may be returned to us, and you will be contacted to arrange re-delivery (additional shipping charges may apply).

Damaged or Incorrect Items
If you receive a damaged, defective, or incorrect item, please contact us within 48 hours of delivery with photos/video of the product and packaging, and we will arrange a replacement or refund as per our Refund & Cancellation Policy.

International Shipping
We currently ship only within India and do not offer international shipping at this time.`;

export const REFUND_POLICY_TEMPLATE = `Order Cancellation
You may cancel your order within {{cancellation_hours}} hours of placing it, provided it has not already been shipped. To cancel, contact us immediately with your order number.

Returns and Exchanges
We accept returns/exchanges within {{return_days}} days of delivery, provided the item is:

Unworn, unwashed, and unused
In its original packaging with all tags intact
Not a sale/clearance item (unless defective)

Certain items such as blouses that have been stitched or altered as per customer requirements are not eligible for return.

How to Initiate a Return
Contact us with your order number and reason for return. Once approved, we will arrange a reverse pickup (where serviceable) or share the return address with you.

Refunds
Once we receive and inspect the returned item, refunds will be processed within 5-7 business days to your original payment method. For Cash on Delivery orders, refunds will be issued via bank transfer or store credit, as per your preference.

Damaged or Defective Items
If you receive a damaged, defective, or wrong item, please reach out within 48 hours of delivery with clear photos/video, and we will offer a free replacement or full refund, whichever you prefer.`;

// ---------------------------------------------------------------------
// Legal pages (Privacy Policy, Terms, Shipping Policy, Refund Policy)
// Stored as one settings row (key = 'legal_pages') so the admin can edit
// all four from one panel without a schema migration.
// ---------------------------------------------------------------------

export type LegalSlug = 'privacy-policy' | 'terms-conditions' | 'shipping-policy' | 'refund-policy';

export interface LegalPages {
  'privacy-policy': string;
  'terms-conditions': string;
  'shipping-policy': string;
  'refund-policy': string;
}

export const LEGAL_PAGE_TITLES: Record<LegalSlug, string> = {
  'privacy-policy': 'Privacy Policy',
  'terms-conditions': 'Terms & Conditions',
  'shipping-policy': 'Shipping Policy',
  'refund-policy': 'Refund & Cancellation Policy',
};

const DEFAULT_LEGAL_PAGES: LegalPages = {
  'privacy-policy':
    'This Privacy Policy explains how we collect, use and protect your personal information when you shop with us. Add your policy content here from the Admin > Marketing tab.',
  'terms-conditions':
    'These Terms & Conditions govern your use of this website and any purchases made through it. Add your policy content here from the Admin > Marketing tab.',
  'shipping-policy': SHIPPING_POLICY_TEMPLATE,
  'refund-policy': REFUND_POLICY_TEMPLATE,
};

export async function fetchLegalPages(): Promise<LegalPages> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'legal_pages')
    .maybeSingle();
  if (error || !data) return DEFAULT_LEGAL_PAGES;
  return { ...DEFAULT_LEGAL_PAGES, ...(data.value as Partial<LegalPages>) };
}

export async function saveLegalPages(pages: LegalPages) {
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'legal_pages', value: pages }, { onConflict: 'key' });
  if (error) throw error;
}

// Same as fetchLegalPages(), but with {{tokens}} already replaced by the
// live Fulfillment Settings numbers. Use this for anything that DISPLAYS
// legal-page text to a shopper (the public /legal/[slug] pages, the live
// chat widget, the AI chat assistant). Do NOT use this for the admin
// editor — it needs the raw, unresolved text so saving it back doesn't
// bake today's numbers in and destroy the tokens.
export async function fetchLegalPagesResolved(): Promise<LegalPages> {
  const [pages, fulfillment] = await Promise.all([fetchLegalPages(), fetchFulfillmentSettings()]);
  return {
    'privacy-policy': applyFulfillmentTokens(pages['privacy-policy'], fulfillment),
    'terms-conditions': applyFulfillmentTokens(pages['terms-conditions'], fulfillment),
    'shipping-policy': applyFulfillmentTokens(pages['shipping-policy'], fulfillment),
    'refund-policy': applyFulfillmentTokens(pages['refund-policy'], fulfillment),
  };
}

// ---------------------------------------------------------------------
// Marketing settings: WhatsApp chat widget + Google Merchant feed toggle
// ---------------------------------------------------------------------

export interface MarketingSettings {
  whatsapp_enabled: boolean;
  whatsapp_chat_widget_enabled: boolean; // separate toggle: WhatsApp bar inside the on-site chat popup
  whatsapp_number: string; // digits only, with country code e.g. 919876543210
  whatsapp_message: string;
  merchant_feed_enabled: boolean;
  merchant_feed_brand: string;
  newsletter_enabled: boolean;
}

const DEFAULT_MARKETING_SETTINGS: MarketingSettings = {
  whatsapp_enabled: false,
  whatsapp_chat_widget_enabled: false,
  whatsapp_number: '',
  whatsapp_message: 'Hi! I have a question about your products.',
  merchant_feed_enabled: true,
  merchant_feed_brand: 'Aruhi Handlooms',
  newsletter_enabled: true,
};

export async function fetchMarketingSettings(): Promise<MarketingSettings> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'marketing_settings')
    .maybeSingle();
  if (error || !data) return DEFAULT_MARKETING_SETTINGS;
  return { ...DEFAULT_MARKETING_SETTINGS, ...(data.value as Partial<MarketingSettings>) };
}

export async function saveMarketingSettings(settings: MarketingSettings) {
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'marketing_settings', value: settings }, { onConflict: 'key' });
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Newsletter subscribers
// ---------------------------------------------------------------------

export interface NewsletterSubscriber {
  id: string;
  email: string;
  source: string | null;
  created_at: string;
}

export async function subscribeToNewsletter(email: string, source = 'footer') {
  const trimmed = email.trim().toLowerCase();
  const { error } = await supabase
    .from('newsletter_subscribers')
    .insert({ email: trimmed, source });
  if (error) {
    // Postgres unique_violation — treat "already subscribed" as success.
    if ((error as { code?: string }).code === '23505') return;
    throw error;
  }
}

export async function fetchNewsletterSubscribers(): Promise<NewsletterSubscriber[]> {
  const { data, error } = await supabase
    .from('newsletter_subscribers')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as NewsletterSubscriber[];
}

export async function deleteNewsletterSubscriber(id: string) {
  const { error } = await supabase.from('newsletter_subscribers').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Site-wide SEO settings (homepage / default meta tags)
// Individual product pages already generate their own meta tags from the
// product data itself, so this only covers the site-level defaults used
// as a fallback and on the homepage.
// ---------------------------------------------------------------------

export interface SeoSettings {
  site_title: string;
  meta_description: string;
  keywords: string; // comma-separated, split into an array before use
  og_image: string;
  google_site_verification: string;
  favicon_url: string;
}

const DEFAULT_SEO_SETTINGS: SeoSettings = {
  site_title: 'Aruhi Handlooms — Handwoven Indian Ethnic Wear & Sarees',
  meta_description:
    'Discover handpicked sarees, lehengas and ethnic wear from master weavers across India. Timeless craftsmanship, modern convenience.',
  keywords: 'saree, ethnic wear, Indian boutique, handwoven sarees, lehenga, silk saree, banarasi, kanjivaram, bridal saree',
  og_image: '',
  google_site_verification: '',
  favicon_url: '',
};

export async function fetchSeoSettings(): Promise<SeoSettings> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'seo_settings')
    .maybeSingle();
  if (error || !data) return DEFAULT_SEO_SETTINGS;
  return { ...DEFAULT_SEO_SETTINGS, ...(data.value as Partial<SeoSettings>) };
}

export async function saveSeoSettings(settings: SeoSettings) {
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'seo_settings', value: settings }, { onConflict: 'key' });
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Analytics: Google Analytics (GA4) + Meta (Facebook) Pixel
// ---------------------------------------------------------------------

export interface AnalyticsSettings {
  ga_enabled: boolean;
  ga_measurement_id: string; // e.g. G-XXXXXXXXXX
  meta_pixel_enabled: boolean;
  meta_pixel_id: string; // numeric Pixel ID
}

const DEFAULT_ANALYTICS_SETTINGS: AnalyticsSettings = {
  ga_enabled: false,
  ga_measurement_id: '',
  meta_pixel_enabled: false,
  meta_pixel_id: '',
};

export async function fetchAnalyticsSettings(): Promise<AnalyticsSettings> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'analytics_settings')
    .maybeSingle();
  if (error || !data) return DEFAULT_ANALYTICS_SETTINGS;
  return { ...DEFAULT_ANALYTICS_SETTINGS, ...(data.value as Partial<AnalyticsSettings>) };
}

export async function saveAnalyticsSettings(settings: AnalyticsSettings) {
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'analytics_settings', value: settings }, { onConflict: 'key' });
  if (error) throw error;
}
