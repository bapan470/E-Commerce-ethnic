'use client';

import { useEffect, useState, FormEvent } from 'react';
import { Save, Download, Trash2, ExternalLink, Copy } from 'lucide-react';
import {
  LegalPages,
  LEGAL_PAGE_TITLES,
  LegalSlug,
  fetchLegalPages,
  saveLegalPages,
  MarketingSettings,
  fetchMarketingSettings,
  saveMarketingSettings,
  NewsletterSubscriber,
  fetchNewsletterSubscribers,
  deleteNewsletterSubscriber,
  SeoSettings,
  fetchSeoSettings,
  saveSeoSettings,
  AnalyticsSettings,
  fetchAnalyticsSettings,
  saveAnalyticsSettings,
} from '@/lib/marketing-api';
import {
  SocialPublishSettings,
  fetchSocialPublishSettings,
  saveSocialPublishSettings,
} from '@/lib/settings-api';
import {
  GrowthSettings,
  DEFAULT_GROWTH_SETTINGS,
  fetchGrowthSettings,
  saveGrowthSettings,
} from '@/lib/growth-api';
import {
  CheckoutBumpSettings,
  DEFAULT_CHECKOUT_BUMP_SETTINGS,
  fetchCheckoutBumpSettings,
  saveCheckoutBumpSettings,
} from '@/lib/checkout-bump-api';
import { fetchProducts } from '@/lib/products-api';
import { Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const LEGAL_SLUGS = Object.keys(LEGAL_PAGE_TITLES) as LegalSlug[];

export default function MarketingPanel() {
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Marketing & SEO</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="legal">
          <TabsList>
            <TabsTrigger value="legal">Legal Pages</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
            <TabsTrigger value="growth">Growth Tools</TabsTrigger>
            <TabsTrigger value="checkout-bump">Checkout Bump</TabsTrigger>
            <TabsTrigger value="newsletter">Newsletter</TabsTrigger>
            <TabsTrigger value="feed">Merchant Feed</TabsTrigger>
            <TabsTrigger value="seo">SEO</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="social-publish">Social Auto-Post</TabsTrigger>
          </TabsList>

          <TabsContent value="legal"><LegalPagesTab /></TabsContent>
          <TabsContent value="whatsapp"><WhatsAppTab /></TabsContent>
          <TabsContent value="growth"><GrowthTab /></TabsContent>
          <TabsContent value="checkout-bump"><CheckoutBumpTab /></TabsContent>
          <TabsContent value="newsletter"><NewsletterTab /></TabsContent>
          <TabsContent value="feed"><MerchantFeedTab /></TabsContent>
          <TabsContent value="seo"><SeoTab /></TabsContent>
          <TabsContent value="analytics"><AnalyticsTab /></TabsContent>
          <TabsContent value="social-publish"><SocialPublishTab /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------
// Legal Pages
// ---------------------------------------------------------------------

function LegalPagesTab() {
  const [pages, setPages] = useState<LegalPages | null>(null);
  const [activeSlug, setActiveSlug] = useState<LegalSlug>('privacy-policy');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchLegalPages()
      .then(setPages)
      .catch(() => toast.error('Failed to load legal pages'));
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!pages) return;
    setSaving(true);
    try {
      await saveLegalPages(pages);
      toast.success('Legal pages saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!pages) return <p className="py-6 text-sm text-muted-foreground">Loading...</p>;

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4">
      <div className="flex flex-wrap gap-2">
        {LEGAL_SLUGS.map((slug) => (
          <button
            type="button"
            key={slug}
            onClick={() => setActiveSlug(slug)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              activeSlug === slug
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:border-primary'
            }`}
          >
            {LEGAL_PAGE_TITLES[slug]}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="legal-content">{LEGAL_PAGE_TITLES[activeSlug]} content</Label>
        <Textarea
          id="legal-content"
          rows={14}
          value={pages[activeSlug]}
          onChange={(e) => setPages({ ...pages, [activeSlug]: e.target.value })}
          placeholder={`Write your ${LEGAL_PAGE_TITLES[activeSlug].toLowerCase()} here...`}
        />
        <p className="text-xs text-muted-foreground">
          Live at <code>/legal/{activeSlug}</code>. Plain text — line breaks are preserved.
        </p>
      </div>

      <Button type="submit" disabled={saving} className="gap-2 bg-primary">
        <Save className="h-4 w-4" />
        {saving ? 'Saving...' : 'Save Legal Pages'}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------
// WhatsApp + Merchant Feed share one settings row, split into two tabs
// ---------------------------------------------------------------------

function useMarketingSettings() {
  const [settings, setSettings] = useState<MarketingSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchMarketingSettings()
      .then(setSettings)
      .catch(() => toast.error('Failed to load marketing settings'));
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await saveMarketingSettings(settings);
      toast.success('Marketing settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return { settings, setSettings, saving, save };
}

function WhatsAppTab() {
  const { settings, setSettings, saving, save } = useMarketingSettings();

  if (!settings) return <p className="py-6 text-sm text-muted-foreground">Loading...</p>;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="mt-4 max-w-lg space-y-4"
    >
      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <div>
          <Label htmlFor="wa-enabled">Show floating WhatsApp button</Label>
          <p className="text-xs text-muted-foreground">Appears on every storefront page (not in admin).</p>
        </div>
        <Switch
          id="wa-enabled"
          checked={settings.whatsapp_enabled}
          onCheckedChange={(checked) => setSettings({ ...settings, whatsapp_enabled: checked })}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <div>
          <Label htmlFor="wa-chat-widget-enabled">Show WhatsApp bar inside chat popup</Label>
          <p className="text-xs text-muted-foreground">
            Controls only the "Prefer WhatsApp?" bar inside the on-site chat popup, separate from the floating button above.
          </p>
        </div>
        <Switch
          id="wa-chat-widget-enabled"
          checked={settings.whatsapp_chat_widget_enabled}
          onCheckedChange={(checked) => setSettings({ ...settings, whatsapp_chat_widget_enabled: checked })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="wa-number">WhatsApp number (with country code, digits only)</Label>
        <Input
          id="wa-number"
          value={settings.whatsapp_number}
          onChange={(e) => setSettings({ ...settings, whatsapp_number: e.target.value })}
          placeholder="919876543210"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="wa-message">Pre-filled message</Label>
        <Textarea
          id="wa-message"
          rows={3}
          value={settings.whatsapp_message}
          onChange={(e) => setSettings({ ...settings, whatsapp_message: e.target.value })}
        />
      </div>

      <Button type="submit" disabled={saving} className="gap-2 bg-primary">
        <Save className="h-4 w-4" />
        {saving ? 'Saving...' : 'Save WhatsApp Settings'}
      </Button>
    </form>
  );
}

function MerchantFeedTab() {
  const { settings, setSettings, saving, save } = useMarketingSettings();
  const [feedUrl, setFeedUrl] = useState('');

  useEffect(() => {
    setFeedUrl(`${window.location.origin}/api/merchant-feed`);
  }, []);

  const copyFeedUrl = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      toast.success('Feed URL copied');
    } catch {
      toast.error('Could not copy — please copy manually');
    }
  };

  if (!settings) return <p className="py-6 text-sm text-muted-foreground">Loading...</p>;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="mt-4 max-w-lg space-y-4"
    >
      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <div>
          <Label htmlFor="feed-enabled">Enable Google Merchant / Meta Catalog feed</Label>
          <p className="text-xs text-muted-foreground">Turn off to make the feed URL return 404.</p>
        </div>
        <Switch
          id="feed-enabled"
          checked={settings.merchant_feed_enabled}
          onCheckedChange={(checked) => setSettings({ ...settings, merchant_feed_enabled: checked })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="feed-brand">Brand name (shown in each feed item)</Label>
        <Input
          id="feed-brand"
          value={settings.merchant_feed_brand}
          onChange={(e) => setSettings({ ...settings, merchant_feed_brand: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Feed URL — add this in Google Merchant Center / Meta Commerce as a scheduled fetch</Label>
        <div className="flex gap-2">
          <Input readOnly value={feedUrl} className="text-xs" />
          <Button type="button" variant="outline" onClick={copyFeedUrl}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" asChild>
            <a href="/api/merchant-feed" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>

      <Button type="submit" disabled={saving} className="gap-2 bg-primary">
        <Save className="h-4 w-4" />
        {saving ? 'Saving...' : 'Save Feed Settings'}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------
// Newsletter subscribers
// ---------------------------------------------------------------------

function NewsletterTab() {
  const [subs, setSubs] = useState<NewsletterSubscriber[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetchNewsletterSubscribers()
      .then(setSubs)
      .catch(() => toast.error('Failed to load subscribers'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteNewsletterSubscriber(id);
      setSubs((prev) => prev?.filter((s) => s.id !== id) ?? null);
      toast.success('Subscriber removed');
    } catch {
      toast.error('Could not remove subscriber');
    }
  };

  const exportCsv = () => {
    if (!subs || subs.length === 0) return;
    const rows = [['email', 'source', 'subscribed_at'], ...subs.map((s) => [s.email, s.source ?? '', s.created_at])];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-4">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading ? 'Loading...' : `${subs?.length ?? 0} subscriber${subs?.length === 1 ? '' : 's'}`}
        </p>
        <Button variant="outline" size="sm" className="gap-2" onClick={exportCsv} disabled={!subs?.length}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {!loading && subs && subs.length === 0 && (
        <p className="text-sm text-muted-foreground">No subscribers yet.</p>
      )}

      {subs && subs.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Subscribed</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-3 py-2">{s.email}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.source || '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Site SEO
// ---------------------------------------------------------------------

function SeoTab() {
  const [seo, setSeo] = useState<SeoSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSeoSettings()
      .then(setSeo)
      .catch(() => toast.error('Failed to load SEO settings'));
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!seo) return;
    setSaving(true);
    try {
      await saveSeoSettings(seo);
      toast.success('SEO settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!seo) return <p className="py-6 text-sm text-muted-foreground">Loading...</p>;

  return (
    <form onSubmit={onSubmit} className="mt-4 max-w-lg space-y-4">
      <div className="space-y-2">
        <Label htmlFor="seo-title">Site title</Label>
        <Input
          id="seo-title"
          value={seo.site_title}
          onChange={(e) => setSeo({ ...seo, site_title: e.target.value })}
          placeholder="Aruhi Handlooms — Handwoven Indian Ethnic Wear & Sarees"
        />
        <p className="text-xs text-muted-foreground">
          Shown in Google search results and the browser tab on the homepage.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="seo-description">Meta description</Label>
        <Textarea
          id="seo-description"
          rows={3}
          value={seo.meta_description}
          onChange={(e) => setSeo({ ...seo, meta_description: e.target.value })}
          placeholder="Discover handpicked sarees, lehengas and ethnic wear..."
        />
        <p className="text-xs text-muted-foreground">
          Ideal length: under 160 characters. Currently {seo.meta_description.length}.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="seo-keywords">Keywords (comma-separated)</Label>
        <Textarea
          id="seo-keywords"
          rows={2}
          value={seo.keywords}
          onChange={(e) => setSeo({ ...seo, keywords: e.target.value })}
          placeholder="saree, ethnic wear, lehenga, silk saree"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="seo-og-image">Social share image URL (Open Graph)</Label>
        <Input
          id="seo-og-image"
          value={seo.og_image}
          onChange={(e) => setSeo({ ...seo, og_image: e.target.value })}
          placeholder="https://your-cdn.com/social-share.jpg"
        />
        <p className="text-xs text-muted-foreground">
          Shown when the site is shared on WhatsApp, Facebook, Twitter/X. Recommended: 1200×630px.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="seo-favicon">Favicon / logo image URL</Label>
        <Input
          id="seo-favicon"
          value={seo.favicon_url}
          onChange={(e) => setSeo({ ...seo, favicon_url: e.target.value })}
          placeholder="https://your-cdn.com/logo-square.png"
        />
        <p className="text-xs text-muted-foreground">
          Used as the browser tab icon and phone home-screen icon. Square image, at least 180×180px.
          Leave blank to use the default monogram icon.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="seo-gsc">Google Search Console verification code</Label>
        <Input
          id="seo-gsc"
          value={seo.google_site_verification}
          onChange={(e) => setSeo({ ...seo, google_site_verification: e.target.value })}
          placeholder="abc123XYZ... (just the content value, not the full <meta> tag)"
        />
        <p className="text-xs text-muted-foreground">
          Google Search Console → Settings → Ownership verification → HTML tag method → copy only
          the <code>content=&quot;...&quot;</code> value here.
        </p>
      </div>

      <Button type="submit" disabled={saving} className="gap-2 bg-primary">
        <Save className="h-4 w-4" />
        {saving ? 'Saving...' : 'Save SEO Settings'}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------
// Analytics: Google Analytics (GA4) + Meta Pixel
// ---------------------------------------------------------------------

function AnalyticsTab() {
  const [analytics, setAnalytics] = useState<AnalyticsSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAnalyticsSettings()
      .then(setAnalytics)
      .catch(() => toast.error('Failed to load analytics settings'));
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!analytics) return;
    setSaving(true);
    try {
      await saveAnalyticsSettings(analytics);
      toast.success('Analytics settings saved — reload the site to see tracking active');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!analytics) return <p className="py-6 text-sm text-muted-foreground">Loading...</p>;

  return (
    <form onSubmit={onSubmit} className="mt-4 max-w-lg space-y-6">
      <div className="space-y-3 rounded-lg border border-border p-3">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="ga-enabled">Google Analytics (GA4)</Label>
            <p className="text-xs text-muted-foreground">Tracks page views, sales, and shopper behaviour.</p>
          </div>
          <Switch
            id="ga-enabled"
            checked={analytics.ga_enabled}
            onCheckedChange={(checked) => setAnalytics({ ...analytics, ga_enabled: checked })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ga-id">Measurement ID</Label>
          <Input
            id="ga-id"
            value={analytics.ga_measurement_id}
            onChange={(e) => setAnalytics({ ...analytics, ga_measurement_id: e.target.value })}
            placeholder="G-XXXXXXXXXX"
          />
          <p className="text-xs text-muted-foreground">
            Google Analytics → Admin → Data Streams → your web stream → copy the Measurement ID.
          </p>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-3">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="pixel-enabled">Meta (Facebook/Instagram) Pixel</Label>
            <p className="text-xs text-muted-foreground">Powers retargeting ads and conversion tracking.</p>
          </div>
          <Switch
            id="pixel-enabled"
            checked={analytics.meta_pixel_enabled}
            onCheckedChange={(checked) => setAnalytics({ ...analytics, meta_pixel_enabled: checked })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pixel-id">Pixel ID</Label>
          <Input
            id="pixel-id"
            value={analytics.meta_pixel_id}
            onChange={(e) => setAnalytics({ ...analytics, meta_pixel_id: e.target.value })}
            placeholder="1234567890123456"
          />
          <p className="text-xs text-muted-foreground">
            Meta Events Manager → Data Sources → your Pixel → copy the numeric Pixel ID.
          </p>
        </div>
      </div>

      <Button type="submit" disabled={saving} className="gap-2 bg-primary">
        <Save className="h-4 w-4" />
        {saving ? 'Saving...' : 'Save Analytics Settings'}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------
// Social Auto-Post: automatically posts every product that goes live —
// vendor-submitted (after AI processing) or admin-added directly — to a
// Facebook Page and/or linked Instagram Business account via the Meta
// Graph API. Actual posting happens server-side in
// lib/social-publish-api.ts; this tab only stores the settings.
// ---------------------------------------------------------------------

function SocialPublishTab() {
  const [settings, setSettings] = useState<SocialPublishSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSocialPublishSettings()
      .then(setSettings)
      .catch(() => toast.error('Failed to load social auto-post settings'));
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      await saveSocialPublishSettings(settings);
      toast.success('Social auto-post settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <p className="py-6 text-sm text-muted-foreground">Loading...</p>;

  return (
    <form onSubmit={onSubmit} className="mt-4 max-w-lg space-y-6">
      <p className="text-xs text-muted-foreground">
        When on, every product that goes live — vendor-submitted (after AI processing) or added
        directly by you — is posted automatically. No manual step needed for either. Facebook +
        Instagram need a Meta App with a long-lived Page Access Token (permissions:
        pages_manage_posts, pages_read_engagement, instagram_content_publish, instagram_basic).
        Threads is a separate login/token (permissions: threads_basic, threads_content_publish) —
        see the Threads section below.
      </p>

      <div className="space-y-3 rounded-lg border border-border p-3">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="fb-enabled">Facebook Page</Label>
            <p className="text-xs text-muted-foreground">Posts as a Page post with the product photo.</p>
          </div>
          <Switch
            id="fb-enabled"
            checked={settings.facebook_enabled}
            onCheckedChange={(checked) => setSettings({ ...settings, facebook_enabled: checked })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fb-page-id">Facebook Page ID</Label>
          <Input
            id="fb-page-id"
            value={settings.facebook_page_id}
            onChange={(e) => setSettings({ ...settings, facebook_page_id: e.target.value })}
            placeholder="1234567890123456"
          />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-3">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="ig-enabled">Instagram</Label>
            <p className="text-xs text-muted-foreground">
              Requires an Instagram Business/Creator account linked to the Page above.
            </p>
          </div>
          <Switch
            id="ig-enabled"
            checked={settings.instagram_enabled}
            onCheckedChange={(checked) => setSettings({ ...settings, instagram_enabled: checked })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ig-account-id">Instagram Business Account ID</Label>
          <Input
            id="ig-account-id"
            value={settings.instagram_business_account_id}
            onChange={(e) => setSettings({ ...settings, instagram_business_account_id: e.target.value })}
            placeholder="17841400000000000"
          />
          <p className="text-xs text-muted-foreground">
            Graph API Explorer → GET /&#123;page-id&#125;?fields=instagram_business_account
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="meta-token">Page Access Token</Label>
        <Input
          id="meta-token"
          type="password"
          value={settings.access_token}
          onChange={(e) => setSettings({ ...settings, access_token: e.target.value })}
          placeholder="EAAG..."
        />
        <p className="text-xs text-muted-foreground">
          A single long-lived Page token is used for both Facebook and Instagram — that&apos;s how
          the Graph API works for a linked Instagram Business account.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-3">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="threads-enabled">Threads</Label>
            <p className="text-xs text-muted-foreground">
              Threads is a separate Meta app/login from Facebook &amp; Instagram — it needs its
              own access token and user ID below, the Page token above won&apos;t work here.
            </p>
          </div>
          <Switch
            id="threads-enabled"
            checked={settings.threads_enabled}
            onCheckedChange={(checked) => setSettings({ ...settings, threads_enabled: checked })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="threads-user-id">Threads User ID</Label>
          <Input
            id="threads-user-id"
            value={settings.threads_user_id}
            onChange={(e) => setSettings({ ...settings, threads_user_id: e.target.value })}
            placeholder="1780..."
          />
          <p className="text-xs text-muted-foreground">
            GET https://graph.threads.net/v1.0/me?access_token=... (with your Threads token) → &quot;id&quot; field
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="threads-token">Threads Access Token</Label>
          <Input
            id="threads-token"
            type="password"
            value={settings.threads_access_token}
            onChange={(e) => setSettings({ ...settings, threads_access_token: e.target.value })}
            placeholder="THQ..."
          />
          <p className="text-xs text-muted-foreground">
            From the Threads API product on your Meta App, with threads_basic + threads_content_publish
            permissions (long-lived token recommended).
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="caption-template">Post Caption Template</Label>
        <Textarea
          id="caption-template"
          rows={5}
          value={settings.caption_template}
          onChange={(e) => setSettings({ ...settings, caption_template: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Placeholders: {'{name}'}, {'{price}'}, {'{description}'}, {'{url}'}
        </p>
      </div>

      <Button type="submit" disabled={saving} className="gap-2 bg-primary">
        <Save className="h-4 w-4" />
        {saving ? 'Saving...' : 'Save Social Auto-Post Settings'}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------
// Growth Tools: urgency banner, low-stock badges, exit-intent popup,
// social proof toasts, sale countdown -- all conversion-focused and all
// toggle-able without touching code.
// ---------------------------------------------------------------------

function GrowthTab() {
  const [settings, setSettings] = useState<GrowthSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchGrowthSettings()
      .then(setSettings)
      .catch(() => toast.error('Failed to load growth settings'));
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      await saveGrowthSettings(settings);
      toast.success('Growth settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <p className="py-6 text-sm text-muted-foreground">Loading...</p>;

  return (
    <form onSubmit={onSubmit} className="space-y-8 py-4">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Urgency banner</p>
            <p className="text-sm text-muted-foreground">Sticky bar at the top of every page.</p>
          </div>
          <Switch
            checked={settings.urgency_banner_enabled}
            onCheckedChange={(v) => setSettings({ ...settings, urgency_banner_enabled: v })}
          />
        </div>
        <Input
          value={settings.urgency_banner_text}
          onChange={(e) => setSettings({ ...settings, urgency_banner_text: e.target.value })}
          placeholder="Free shipping on orders above ₹1999 — today only!"
        />
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Low stock badge</p>
            <p className="text-sm text-muted-foreground">Shows "Only N left" on product pages.</p>
          </div>
          <Switch
            checked={settings.low_stock_enabled}
            onCheckedChange={(v) => setSettings({ ...settings, low_stock_enabled: v })}
          />
        </div>
        <div className="max-w-xs">
          <Label>Show badge when stock is at or below</Label>
          <Input
            type="number"
            min={1}
            value={settings.low_stock_threshold}
            onChange={(e) => setSettings({ ...settings, low_stock_threshold: Number(e.target.value) })}
          />
        </div>
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Exit-intent discount popup</p>
            <p className="text-sm text-muted-foreground">
              Shows once per visit when the cursor heads toward the tab bar.
            </p>
          </div>
          <Switch
            checked={settings.exit_intent_enabled}
            onCheckedChange={(v) => setSettings({ ...settings, exit_intent_enabled: v })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Headline</Label>
            <Input
              value={settings.exit_intent_headline}
              onChange={(e) => setSettings({ ...settings, exit_intent_headline: e.target.value })}
            />
          </div>
          <div>
            <Label>Coupon code shown</Label>
            <Input
              value={settings.exit_intent_coupon_code}
              onChange={(e) => setSettings({ ...settings, exit_intent_coupon_code: e.target.value })}
            />
          </div>
        </div>
        <div>
          <Label>Message</Label>
          <Textarea
            rows={2}
            value={settings.exit_intent_message}
            onChange={(e) => setSettings({ ...settings, exit_intent_message: e.target.value })}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Create this coupon code under Admin &gt; Coupons so it actually works at checkout.
        </p>
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Social proof toasts</p>
            <p className="text-sm text-muted-foreground">
              "Someone in [city] just bought this" — pulled from real recent orders.
            </p>
          </div>
          <Switch
            checked={settings.social_proof_enabled}
            onCheckedChange={(v) => setSettings({ ...settings, social_proof_enabled: v })}
          />
        </div>
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Frequently Bought Together</p>
            <p className="text-sm text-muted-foreground">
              Shows bundle suggestions on product pages. Pairs are curated under Admin &gt;
              Marketing &gt; Bundles, or auto-computed from past orders.
            </p>
          </div>
          <Switch
            checked={settings.bundles_enabled}
            onCheckedChange={(v) => setSettings({ ...settings, bundles_enabled: v })}
          />
        </div>
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Sale countdown bar</p>
            <p className="text-sm text-muted-foreground">Ticking countdown until a set end time.</p>
          </div>
          <Switch
            checked={settings.sale_countdown_enabled}
            onCheckedChange={(v) => setSettings({ ...settings, sale_countdown_enabled: v })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Text</Label>
            <Input
              value={settings.sale_countdown_text}
              onChange={(e) => setSettings({ ...settings, sale_countdown_text: e.target.value })}
            />
          </div>
          <div>
            <Label>Ends at</Label>
            <Input
              type="datetime-local"
              value={settings.sale_countdown_end_at ? settings.sale_countdown_end_at.slice(0, 16) : ''}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  sale_countdown_end_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                })
              }
            />
          </div>
        </div>
      </section>

      <Button type="submit" disabled={saving} className="gap-2 bg-primary">
        <Save className="h-4 w-4" />
        {saving ? 'Saving...' : 'Save Growth Settings'}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------
// Checkout Order Bump
// ---------------------------------------------------------------------

function CheckoutBumpTab() {
  const [settings, setSettings] = useState<CheckoutBumpSettings | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCheckoutBumpSettings()
      .then(setSettings)
      .catch(() => toast.error('Failed to load checkout bump settings'));
    fetchProducts()
      .then(setProducts)
      .catch(() => toast.error('Failed to load products'));
  }, []);

  const selectedProduct = products.find((p) => p.id === settings?.product_id) || null;
  const bumpPrice = selectedProduct
    ? Math.round(selectedProduct.price * (1 - (settings?.discount_percent ?? 0) / 100))
    : null;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    if (settings.enabled && !settings.product_id) {
      toast.error('Pick a product first, or turn the bump off');
      return;
    }
    setSaving(true);
    try {
      await saveCheckoutBumpSettings(settings);
      toast.success('Checkout bump settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <p className="py-6 text-sm text-muted-foreground">Loading...</p>;

  return (
    <form onSubmit={onSubmit} className="space-y-6 py-4">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Ek chota, discounted add-on product jo checkout page par har customer ko dikhta hai —
        cart mein jo bhi ho, iska koi lena-dena nahi. One-click "Add" karte hi order total mein
        turant jud jata hai. Isse average order value badhta hai (classic "order bump" — jaise
        ₹99 ka pouch/scarf add karna).
      </p>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Enable checkout bump</p>
            <p className="text-sm text-muted-foreground">
              Order Summary ke andar, "Place Order" button ke upar dikhega.
            </p>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(v) => setSettings({ ...settings, enabled: v })}
          />
        </div>
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <div>
          <Label>Product</Label>
          <Select
            value={settings.product_id ?? ''}
            onValueChange={(v) => setSettings({ ...settings, product_id: v })}
          >
            <SelectTrigger className="max-w-sm">
              <SelectValue placeholder="Choose a product" />
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} — ₹{p.price}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">
            Kuch sasta, high-margin, sabke liye relevant product chuno (pouch, scarf, jewellery
            box, styling accessory) — kapde ka size/fit nahi hona chahiye, kyunki checkout par
            size select karne ka option nahi hoga.
          </p>
        </div>

        <div className="max-w-xs">
          <Label>Discount on checkout (%)</Label>
          <Input
            type="number"
            min={0}
            max={90}
            value={settings.discount_percent}
            onChange={(e) =>
              setSettings({ ...settings, discount_percent: Number(e.target.value) })
            }
          />
        </div>

        {selectedProduct && bumpPrice !== null && (
          <div className="rounded-md bg-muted/50 p-3 text-sm">
            <p>
              Customer ko dikhega: <strong>{selectedProduct.name}</strong> — normal price ₹
              {selectedProduct.price}, checkout price{' '}
              <strong className="text-primary">₹{bumpPrice}</strong>
              {settings.discount_percent > 0 ? ` (${settings.discount_percent}% off)` : ''}.
            </p>
          </div>
        )}
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Headline</Label>
            <Input
              value={settings.headline}
              onChange={(e) => setSettings({ ...settings, headline: e.target.value })}
            />
          </div>
        </div>
        <div>
          <Label>Subtext</Label>
          <Textarea
            rows={2}
            value={settings.subtext}
            onChange={(e) => setSettings({ ...settings, subtext: e.target.value })}
          />
        </div>
      </section>

      <Button type="submit" disabled={saving} className="gap-2 bg-primary">
        <Save className="h-4 w-4" />
        {saving ? 'Saving...' : 'Save Checkout Bump'}
      </Button>
    </form>
  );
}
