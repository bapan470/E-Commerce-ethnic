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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
            <TabsTrigger value="newsletter">Newsletter</TabsTrigger>
            <TabsTrigger value="feed">Merchant Feed</TabsTrigger>
            <TabsTrigger value="seo">SEO</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="legal"><LegalPagesTab /></TabsContent>
          <TabsContent value="whatsapp"><WhatsAppTab /></TabsContent>
          <TabsContent value="newsletter"><NewsletterTab /></TabsContent>
          <TabsContent value="feed"><MerchantFeedTab /></TabsContent>
          <TabsContent value="seo"><SeoTab /></TabsContent>
          <TabsContent value="analytics"><AnalyticsTab /></TabsContent>
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
