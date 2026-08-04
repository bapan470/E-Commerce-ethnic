// ---------------------------------------------------------------------
// WooCommerce imported-customer drip automation (welcome -> follow-up)
// + the shared product-fetch helper used both by the manual "premium
// template" picker's API route and by this automation.
//
// Flow:
//   1. Every non-opted-out imported customer who has never been sent a
//      "welcome" email gets one queued (woocommerce_send_queue).
//   2. Once a customer's welcome email has actually been SENT, they get a
//      "followup" queued `followup_delay_days` after that send.
//   3. A single daily cron tick (see lib/cron-jobs.ts / vercel.json) works
//      the queue oldest-scheduled-first, stopping once it hits the daily
//      send cap -- so a 2000+ contact list drips out over many days
//      instead of going out in one blast.
//   4. The whole thing is a no-op while `enabled` is false (the admin's
//      on/off toggle).
//
// NOTE ON SCHEDULING GRANULARITY: this app's cron only runs once a day
// (see the comment in app/api/cron/daily-jobs/route.ts -- Vercel Hobby
// plan limit), so "send after N hours" (manual schedule) and the daily
// cap both resolve at day granularity: a queued row becomes eligible once
// its scheduled_at has passed, and is actually sent on the next cron run
// after that, capped at `dailySendCap` sends per run/day.
// ---------------------------------------------------------------------

import { getSupabaseAdmin } from './supabase-admin';
import { sendEmail } from './email';
import {
  buildPremiumCampaignHtml,
  wrapCampaignLinksForClickTracking,
  TRACKING_PIXEL_PLACEHOLDER,
  UNSUBSCRIBE_LINK_PLACEHOLDER,
  type CampaignProduct,
  type CampaignCategory,
  type CampaignTemplateId,
} from './campaign-templates';
import { randomUUID } from 'crypto';

const SETTINGS_KEY = 'woocommerce_drip_automation_settings';

export interface DripStepSettings {
  templateId: CampaignTemplateId;
  subject: string;
  headline: string;
  subheadline: string;
}

export interface WooCommerceDripSettings {
  enabled: boolean;
  dailySendCap: number; // e.g. 50 -- max campaign emails (manual-scheduled + welcome + followup combined) per cron run/day
  followupDelayDays: number; // e.g. 3 -- days after the welcome email is SENT before the followup queues
  sourceStoreName: string;
  welcome: DripStepSettings;
  followup: DripStepSettings;
}

export const DEFAULT_WOOCOMMERCE_DRIP_SETTINGS: WooCommerceDripSettings = {
  enabled: false,
  dailySendCap: 50,
  followupDelayDays: 3,
  sourceStoreName: '',
  welcome: {
    templateId: 'introduction',
    subject: 'Introducing AruhiHandlooms',
    headline: 'Introducing AruhiHandlooms',
    subheadline: '',
  },
  followup: {
    templateId: 'new-arrivals',
    subject: 'Fresh Off The Loom — New Arrivals',
    headline: 'Fresh Off The Loom — New Arrivals',
    subheadline: '',
  },
};

export async function fetchDripSettings(supabase = getSupabaseAdmin()): Promise<WooCommerceDripSettings> {
  const { data } = await supabase.from('settings').select('value').eq('key', SETTINGS_KEY).maybeSingle();
  if (!data?.value) return DEFAULT_WOOCOMMERCE_DRIP_SETTINGS;
  const v = data.value as Partial<WooCommerceDripSettings>;
  return {
    ...DEFAULT_WOOCOMMERCE_DRIP_SETTINGS,
    ...v,
    welcome: { ...DEFAULT_WOOCOMMERCE_DRIP_SETTINGS.welcome, ...(v.welcome ?? {}) },
    followup: { ...DEFAULT_WOOCOMMERCE_DRIP_SETTINGS.followup, ...(v.followup ?? {}) },
  };
}

export async function saveDripSettings(settings: WooCommerceDripSettings, supabase = getSupabaseAdmin()) {
  const { error } = await supabase
    .from('settings')
    .upsert({ key: SETTINGS_KEY, value: settings }, { onConflict: 'key' });
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Shared product/category fetch for building a premium template's HTML.
// Trimmed version of the logic in
// app/api/admin/woocommerce-import/featured-products/route.ts (kept in
// sync manually since one runs from a browser-triggered API route and the
// other from the server-only cron -- duplicating ~30 lines here is safer
// than routing the cron through an HTTP call to itself).
// ---------------------------------------------------------------------
export async function fetchCampaignProductsAndCategories(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  siteUrl: string,
  limit = 6
): Promise<{ products: CampaignProduct[]; categories: CampaignCategory[] }> {
  const PRODUCT_COLUMNS = 'id, name, slug, price, mrp, images, category_name, featured, in_stock';

  const { data: featured } = await supabase
    .from('products')
    .select(PRODUCT_COLUMNS)
    .eq('featured', true)
    .eq('in_stock', true)
    .not('images', 'eq', '{}')
    .order('updated_at', { ascending: false })
    .limit(limit);
  let products: any[] = featured ?? [];

  if (products.length < limit) {
    const have = new Set(products.map((p) => p.id));
    const { data: fillIn } = await supabase
      .from('products')
      .select(PRODUCT_COLUMNS)
      .eq('in_stock', true)
      .not('images', 'eq', '{}')
      .order('created_at', { ascending: false })
      .limit(limit * 2);
    for (const p of fillIn ?? []) {
      if (products.length >= limit) break;
      if (!have.has(p.id)) {
        products.push(p);
        have.add(p.id);
      }
    }
  }

  const { data: categoryRows } = await supabase.from('categories').select('id, name, slug').order('name', { ascending: true });
  const categories: CampaignCategory[] = [];
  for (const c of categoryRows ?? []) {
    const { data: catProducts } = await supabase
      .from('products')
      .select('images, featured')
      .eq('category_name', c.name)
      .eq('in_stock', true)
      .not('images', 'eq', '{}')
      .order('featured', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(1);
    const thumb = catProducts?.[0]?.images?.[0] ?? null;
    if (thumb) categories.push({ name: c.name, slug: c.slug, image: thumb, url: `${siteUrl}/category/${c.slug}` });
  }

  const result: CampaignProduct[] = products.slice(0, limit).map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: p.price,
    mrp: p.mrp,
    image: p.images?.[0] || null,
    category_name: p.category_name,
    url: `${siteUrl}/product/${p.slug}`,
  }));

  return { products: result, categories };
}

// ---------------------------------------------------------------------
// Actually sends one queued row: inserts the woocommerce_campaign_sends
// row up front (so the unsubscribe/click links embedded in the email are
// valid the instant it lands), wraps tracking, sends, then updates status.
// Mirrors app/api/admin/woocommerce-import/send-campaign/route.ts's
// per-recipient logic.
// ---------------------------------------------------------------------
async function sendQueuedEmail(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  queueRow: { id: string; customer_id: string; subject: string; html: string | null; campaign_type: string },
  customerEmail: string,
  siteUrl: string
): Promise<'sent' | 'failed' | 'skipped'> {
  const sendId = randomUUID();
  const automationStep = queueRow.campaign_type === 'manual' ? null : queueRow.campaign_type;

  await supabase.from('woocommerce_campaign_sends').insert({
    id: sendId,
    customer_id: queueRow.customer_id,
    email: customerEmail,
    subject: queueRow.subject,
    status: 'sending',
    automation_step: automationStep,
  });

  let html = queueRow.html ?? '';
  html = html.replace(
    TRACKING_PIXEL_PLACEHOLDER,
    `<img src="${siteUrl}/api/track/open/${sendId}" width="1" height="1" alt="" style="display:block; border:0;" />`
  );
  html = wrapCampaignLinksForClickTracking(html, sendId, siteUrl);
  html = html.split(UNSUBSCRIBE_LINK_PLACEHOLDER).join(`${siteUrl}/api/unsubscribe/${sendId}`);

  const result = await sendEmail({ to: customerEmail, subject: queueRow.subject, html });
  const status: 'sent' | 'failed' | 'skipped' = result.success
    ? 'sent'
    : 'skipped' in result && result.skipped
      ? 'skipped'
      : 'failed';

  await supabase
    .from('woocommerce_campaign_sends')
    .update({ status, error: result.success ? null : String((result as any).error ?? '') })
    .eq('id', sendId);

  await supabase
    .from('woocommerce_send_queue')
    .update({ status, send_id: sendId })
    .eq('id', queueRow.id);

  return status;
}

// ---------------------------------------------------------------------
// Main job, called once/day from lib/cron-jobs.ts -> runWooCommerceDripJob.
// ---------------------------------------------------------------------
export async function runWooCommerceDripJob() {
  const supabase = getSupabaseAdmin();
  const settings = await fetchDripSettings(supabase);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');

  if (!settings.enabled) {
    return { skipped: true, reason: 'automation is off' };
  }

  const dailyCap = Math.max(1, Number(settings.dailySendCap) || 50);

  // --- 1. Enqueue welcome emails for customers who don't have one yet ---
  const { data: candidates } = await supabase
    .from('woocommerce_customers')
    .select('id')
    .eq('opted_out', false)
    .order('imported_at', { ascending: true })
    .limit(5000);

  const candidateIds = (candidates ?? []).map((c) => c.id);
  let welcomeQueued = 0;
  if (candidateIds.length > 0) {
    const { data: alreadySent } = await supabase
      .from('woocommerce_campaign_sends')
      .select('customer_id')
      .eq('automation_step', 'welcome')
      .in('customer_id', candidateIds);
    const { data: alreadyQueued } = await supabase
      .from('woocommerce_send_queue')
      .select('customer_id')
      .eq('campaign_type', 'welcome')
      .in('status', ['queued', 'sent'])
      .in('customer_id', candidateIds);
    const skip = new Set([...(alreadySent ?? []), ...(alreadyQueued ?? [])].map((r: any) => r.customer_id));
    const needWelcome = candidateIds.filter((id) => !skip.has(id));

    if (needWelcome.length > 0) {
      const { products, categories } = await fetchCampaignProductsAndCategories(supabase, siteUrl, 6);
      const html = buildPremiumCampaignHtml({
        templateId: settings.welcome.templateId,
        headline: settings.welcome.headline,
        subheadline: settings.welcome.subheadline || undefined,
        products,
        categories,
        sourceStoreName: settings.sourceStoreName || undefined,
      });
      const rows = needWelcome.map((customer_id) => ({
        customer_id,
        campaign_type: 'welcome',
        subject: settings.welcome.subject,
        html,
        scheduled_at: new Date().toISOString(),
        status: 'queued',
      }));
      // Insert in chunks so one giant list doesn't hit a payload limit.
      for (let i = 0; i < rows.length; i += 500) {
        await supabase.from('woocommerce_send_queue').insert(rows.slice(i, i + 500));
      }
      welcomeQueued = rows.length;
    }
  }

  // --- 2. Enqueue follow-ups for customers whose welcome was sent long enough ago ---
  const delayMs = Math.max(0, Number(settings.followupDelayDays) || 0) * 24 * 60 * 60 * 1000;
  const cutoffIso = new Date(Date.now() - delayMs).toISOString();
  const { data: dueWelcomeSends } = await supabase
    .from('woocommerce_campaign_sends')
    .select('customer_id, sent_at, email')
    .eq('automation_step', 'welcome')
    .eq('status', 'sent')
    .lte('sent_at', cutoffIso)
    .limit(5000);

  let followupQueued = 0;
  if (dueWelcomeSends && dueWelcomeSends.length > 0) {
    const dueIds = dueWelcomeSends.map((r) => r.customer_id);
    const { data: alreadySentF } = await supabase
      .from('woocommerce_campaign_sends')
      .select('customer_id')
      .eq('automation_step', 'followup')
      .in('customer_id', dueIds);
    const { data: alreadyQueuedF } = await supabase
      .from('woocommerce_send_queue')
      .select('customer_id')
      .eq('campaign_type', 'followup')
      .in('status', ['queued', 'sent'])
      .in('customer_id', dueIds);
    const { data: optedOutRows } = await supabase.from('woocommerce_customers').select('id').eq('opted_out', true).in('id', dueIds);
    const skip = new Set(
      [...(alreadySentF ?? []), ...(alreadyQueuedF ?? []), ...(optedOutRows ?? []).map((r: any) => ({ customer_id: r.id }))].map(
        (r: any) => r.customer_id
      )
    );
    const needFollowup = dueWelcomeSends.filter((r) => !skip.has(r.customer_id));

    if (needFollowup.length > 0) {
      const { products, categories } = await fetchCampaignProductsAndCategories(supabase, siteUrl, 6);
      const html = buildPremiumCampaignHtml({
        templateId: settings.followup.templateId,
        headline: settings.followup.headline,
        subheadline: settings.followup.subheadline || undefined,
        products,
        categories,
        sourceStoreName: settings.sourceStoreName || undefined,
      });
      const rows = needFollowup.map((r) => ({
        customer_id: r.customer_id,
        campaign_type: 'followup',
        subject: settings.followup.subject,
        html,
        scheduled_at: new Date().toISOString(),
        status: 'queued',
      }));
      for (let i = 0; i < rows.length; i += 500) {
        await supabase.from('woocommerce_send_queue').insert(rows.slice(i, i + 500));
      }
      followupQueued = rows.length;
    }
  }

  // --- 3. How much of today's cap is already used (manual immediate sends included) ---
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { count: sentToday } = await supabase
    .from('woocommerce_campaign_sends')
    .select('id', { count: 'exact', head: true })
    .gte('sent_at', todayStart.toISOString())
    .in('status', ['sent', 'failed']);

  let remaining = dailyCap - (sentToday ?? 0);
  if (remaining <= 0) {
    return { welcomeQueued, followupQueued, sent: 0, failed: 0, skipped: 0, reason: 'daily cap already reached' };
  }

  // --- 4. Work the queue, oldest-scheduled-first ("top of the list"), due rows only ---
  const { data: due } = await supabase
    .from('woocommerce_send_queue')
    .select('id, customer_id, subject, html, campaign_type')
    .eq('status', 'queued')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(remaining);

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of due ?? []) {
    const { data: customer } = await supabase
      .from('woocommerce_customers')
      .select('email, opted_out')
      .eq('id', row.customer_id)
      .maybeSingle();

    if (!customer?.email || customer.opted_out) {
      await supabase.from('woocommerce_send_queue').update({ status: 'skipped' }).eq('id', row.id);
      skipped += 1;
      continue;
    }

    const status = await sendQueuedEmail(supabase, row as any, customer.email, siteUrl);
    if (status === 'sent') sent += 1;
    else if (status === 'failed') failed += 1;
    else skipped += 1;

    // Gentle pacing, same as the manual send-campaign route.
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  return { welcomeQueued, followupQueued, sent, failed, skipped };
}
