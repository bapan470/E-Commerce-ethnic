// ---------------------------------------------------------------------
// Auto-publish a product to Facebook (Page) and Instagram (Business
// account linked to that Page) via the Meta Graph API, the moment the
// product goes live — whether it came from a vendor's AI-processed
// listing (app/api/vendor/ai-process/[id]/route.ts) or an admin's
// direct "Add Product" (components/admin/products-panel.tsx via the
// new app/api/social/publish route).
//
// This file is server-only (uses fetch to graph.facebook.com and the
// Supabase admin client) — never import it from a 'use client' file.
//
// SETUP (one-time, in Admin > Marketing > Social Auto-Post):
//   1. Create a Meta App at developers.facebook.com, add the
//      "Facebook Login for Business" + Instagram Graph API products.
//   2. Get a long-lived Page Access Token for your Facebook Page, with
//      the pages_manage_posts, pages_read_engagement and
//      instagram_content_publish, instagram_basic permissions.
//   3. Note your Facebook Page ID.
//   4. If posting to Instagram too, the Page must have an Instagram
//      Business/Creator account linked — note that account's ID
//      (Graph API: GET /{page-id}?fields=instagram_business_account).
//   5. Paste the Page ID, Instagram Business Account ID, and the
//      access token into Admin > Marketing > Social Auto-Post, and
//      toggle Facebook / Instagram on.
//   6. Threads is a SEPARATE Meta app/OAuth flow (graph.threads.net,
//      not graph.facebook.com) — the token above will NOT work here.
//      Create/enable the Threads API product on your Meta App, get a
//      Threads access token with threads_basic + threads_content_publish,
//      then call GET https://graph.threads.net/v1.0/me?access_token=...
//      to get your Threads user id. Paste both into Admin > Marketing >
//      Social Auto-Post and toggle Threads on.
// ---------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// Threads is also a Meta product, but it runs on a completely separate
// Graph API host/version with its own OAuth app, its own access token,
// and its own user id — the Facebook Page token used for FB/Instagram
// above does NOT work here.
const THREADS_API_BASE = 'https://graph.threads.net/v1.0';

export interface SocialPublishSettings {
  facebook_enabled: boolean;
  instagram_enabled: boolean;
  // Long-lived Page Access Token. The same token is used for both the
  // Facebook Page post and the linked Instagram Business account post
  // (that's how the Graph API works — Instagram publishing goes
  // through the Page's token, not a separate Instagram login).
  access_token: string;
  facebook_page_id: string;
  instagram_business_account_id: string;
  // Threads (separate Meta app/OAuth — see THREADS_API_BASE above).
  threads_enabled: boolean;
  threads_access_token: string;
  threads_user_id: string;
  // Template for the post caption. {name}, {price}, {url}, {description}
  // are replaced with the product's actual values.
  caption_template: string;
}

export const DEFAULT_SOCIAL_PUBLISH_SETTINGS: SocialPublishSettings = {
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

const SETTINGS_KEY = 'social_publish';

/** Server-side read (route handlers / cron — pass in the admin client you already have). */
export async function fetchSocialPublishSettingsServer(
  admin: SupabaseClient
): Promise<SocialPublishSettings> {
  const { data, error } = await admin
    .from('settings')
    .select('value')
    .eq('key', SETTINGS_KEY)
    .maybeSingle();
  if (error || !data) return DEFAULT_SOCIAL_PUBLISH_SETTINGS;
  return { ...DEFAULT_SOCIAL_PUBLISH_SETTINGS, ...(data.value as Partial<SocialPublishSettings>) };
}

/** Server-side write (used by the admin settings API route). */
export async function saveSocialPublishSettingsServer(
  admin: SupabaseClient,
  settings: SocialPublishSettings
): Promise<void> {
  const { error } = await admin
    .from('settings')
    .upsert({ key: SETTINGS_KEY, value: settings }, { onConflict: 'key' });
  if (error) throw error;
}

interface ProductForSocial {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  price: number;
  images?: string[] | null;
  social_posted_at?: string | null;
}

function buildCaption(template: string, product: ProductForSocial, siteUrl: string): string {
  const description = (product.description || '').slice(0, 300);
  const url = `${siteUrl.replace(/\/$/, '')}/product/${product.slug}`;
  return template
    .replaceAll('{name}', product.name || '')
    .replaceAll('{price}', String(product.price ?? ''))
    .replaceAll('{url}', url)
    .replaceAll('{description}', description);
}

async function postToFacebook(
  settings: SocialPublishSettings,
  caption: string,
  imageUrl: string | undefined
): Promise<string | null> {
  const endpoint = imageUrl
    ? `${GRAPH_API_BASE}/${settings.facebook_page_id}/photos`
    : `${GRAPH_API_BASE}/${settings.facebook_page_id}/feed`;

  const body = new URLSearchParams({
    access_token: settings.access_token,
    ...(imageUrl ? { url: imageUrl, caption } : { message: caption }),
  });

  const res = await fetch(endpoint, { method: 'POST', body });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(`Facebook post failed: ${json?.error?.message || res.statusText}`);
  }
  return json.post_id || json.id || null;
}

async function postToInstagram(
  settings: SocialPublishSettings,
  caption: string,
  imageUrl: string
): Promise<string | null> {
  // Step 1: create a media container.
  const createRes = await fetch(
    `${GRAPH_API_BASE}/${settings.instagram_business_account_id}/media`,
    {
      method: 'POST',
      body: new URLSearchParams({
        image_url: imageUrl,
        caption,
        access_token: settings.access_token,
      }),
    }
  );
  const createJson = await createRes.json();
  if (!createRes.ok || createJson.error || !createJson.id) {
    throw new Error(`Instagram container create failed: ${createJson?.error?.message || createRes.statusText}`);
  }

  // Step 2: publish the container.
  const publishRes = await fetch(
    `${GRAPH_API_BASE}/${settings.instagram_business_account_id}/media_publish`,
    {
      method: 'POST',
      body: new URLSearchParams({
        creation_id: createJson.id,
        access_token: settings.access_token,
      }),
    }
  );
  const publishJson = await publishRes.json();
  if (!publishRes.ok || publishJson.error) {
    throw new Error(`Instagram publish failed: ${publishJson?.error?.message || publishRes.statusText}`);
  }
  return publishJson.id || null;
}

async function postToThreads(
  settings: SocialPublishSettings,
  caption: string,
  imageUrl: string | undefined
): Promise<string | null> {
  // Step 1: create a media container (TEXT if no image, IMAGE if there is one).
  const createParams = new URLSearchParams({
    access_token: settings.threads_access_token,
    text: caption,
    media_type: imageUrl ? 'IMAGE' : 'TEXT',
  });
  if (imageUrl) createParams.set('image_url', imageUrl);

  const createRes = await fetch(`${THREADS_API_BASE}/${settings.threads_user_id}/threads`, {
    method: 'POST',
    body: createParams,
  });
  const createJson = await createRes.json();
  if (!createRes.ok || createJson.error || !createJson.id) {
    throw new Error(`Threads container create failed: ${createJson?.error?.message || createRes.statusText}`);
  }

  // Step 2: publish the container.
  const publishRes = await fetch(`${THREADS_API_BASE}/${settings.threads_user_id}/threads_publish`, {
    method: 'POST',
    body: new URLSearchParams({
      creation_id: createJson.id,
      access_token: settings.threads_access_token,
    }),
  });
  const publishJson = await publishRes.json();
  if (!publishRes.ok || publishJson.error) {
    throw new Error(`Threads publish failed: ${publishJson?.error?.message || publishRes.statusText}`);
  }
  return publishJson.id || null;
}

/**
 * Posts a single product to Facebook and/or Instagram per whatever's
 * enabled in settings, then stamps social_posted_at so it never gets
 * posted twice. Designed to be called fire-and-forget with .catch() —
 * a social-post failure must NEVER block or unwind the product actually
 * going live in the store.
 */
export async function publishProductToSocial(
  admin: SupabaseClient,
  product: ProductForSocial
): Promise<void> {
  if (product.social_posted_at) return; // already posted once — don't duplicate

  const settings = await fetchSocialPublishSettingsServer(admin);
  if (!settings.facebook_enabled && !settings.instagram_enabled) return;
  if (!settings.access_token) return;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://your-store.example.com';
  const caption = buildCaption(settings.caption_template, product, siteUrl);
  const imageUrl = (product.images || [])[0];

  const postIds: Record<string, string> = {};
  const errors: string[] = [];

  if (settings.facebook_enabled && settings.facebook_page_id) {
    try {
      const id = await postToFacebook(settings, caption, imageUrl);
      if (id) postIds.facebook_post_id = id;
    } catch (err) {
      console.error('[social-publish] Facebook post failed for product', product.id, err);
      errors.push(String(err));
    }
  }

  if (settings.instagram_enabled && settings.instagram_business_account_id) {
    if (!imageUrl) {
      console.error('[social-publish] Instagram skipped for product', product.id, '— no image');
    } else {
      try {
        const id = await postToInstagram(settings, caption, imageUrl);
        if (id) postIds.instagram_media_id = id;
      } catch (err) {
        console.error('[social-publish] Instagram post failed for product', product.id, err);
        errors.push(String(err));
      }
    }
  }

  if (settings.threads_enabled && settings.threads_user_id) {
    try {
      const id = await postToThreads(settings, caption, imageUrl);
      if (id) postIds.threads_post_id = id;
    } catch (err) {
      console.error('[social-publish] Threads post failed for product', product.id, err);
      errors.push(String(err));
    }
  }

  // Stamp as posted even on partial failure, so a permanently-broken
  // token doesn't retry-loop forever on every future product. Full
  // success/failure detail is in postIds / server logs.
  await admin
    .from('products')
    .update({ social_posted_at: new Date().toISOString(), social_post_ids: postIds })
    .eq('id', product.id);
}
