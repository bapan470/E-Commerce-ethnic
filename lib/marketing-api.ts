import { supabase } from './supabase';

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
  'shipping-policy':
    'We dispatch orders within 2-3 business days. Delivery timelines vary by location. Add your policy content here from the Admin > Marketing tab.',
  'refund-policy':
    'We accept returns and exchanges within 7 days of delivery on unworn items with original packaging. Add your policy content here from the Admin > Marketing tab.',
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

// ---------------------------------------------------------------------
// Marketing settings: WhatsApp chat widget + Google Merchant feed toggle
// ---------------------------------------------------------------------

export interface MarketingSettings {
  whatsapp_enabled: boolean;
  whatsapp_number: string; // digits only, with country code e.g. 919876543210
  whatsapp_message: string;
  merchant_feed_enabled: boolean;
  merchant_feed_brand: string;
  newsletter_enabled: boolean;
}

const DEFAULT_MARKETING_SETTINGS: MarketingSettings = {
  whatsapp_enabled: false,
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
