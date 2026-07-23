'use client';

import { useEffect, useState, FormEvent } from 'react';
import { Save, Upload, Loader2, Trash2 } from 'lucide-react';
import Image from 'next/image';
import {
  StoreInfo,
  fetchStoreInfo,
  saveStoreInfo,
  EmailSettings,
  fetchEmailSettings,
  saveEmailSettings,
  SiteBanner,
  fetchSiteBanner,
  saveSiteBanner,
  AiChatSettings,
  fetchAiChatSettings,
  saveAiChatSettings,
  AI_CHAT_MODEL_OPTIONS,
  SocialLinks,
  fetchSocialLinks,
  saveSocialLinks,
} from '@/lib/settings-api';
import { uploadProductImage } from '@/lib/products-api';
import {
  ShippingSettings,
  fetchShippingSettings,
  saveShippingSettings,
} from '@/lib/pincode-api';
import {
  DelhiverySettings,
  fetchDelhiverySettings,
  saveDelhiverySettings,
} from '@/lib/delhivery-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export default function SettingsPanel() {
  const [form, setForm] = useState<StoreInfo | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [checkoutForm, setCheckoutForm] = useState<ShippingSettings | null>(null);
  const [savingCheckout, setSavingCheckout] = useState(false);

  const [delhiveryForm, setDelhiveryForm] = useState<DelhiverySettings | null>(null);
  const [savingDelhivery, setSavingDelhivery] = useState(false);

  const [emailForm, setEmailForm] = useState<EmailSettings | null>(null);
  const [savingEmail, setSavingEmail] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  const [bannerForm, setBannerForm] = useState<SiteBanner | null>(null);
  const [savingBanner, setSavingBanner] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const [aiChatForm, setAiChatForm] = useState<AiChatSettings | null>(null);
  const [savingAiChat, setSavingAiChat] = useState(false);
  const [testingAiChat, setTestingAiChat] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<any>(null);

  const [socialForm, setSocialForm] = useState<SocialLinks | null>(null);
  const [savingSocial, setSavingSocial] = useState(false);

  useEffect(() => {
    fetchStoreInfo()
      .then(setForm)
      .catch(() => toast.error('Failed to load store settings'))
      .finally(() => setLoading(false));

    fetchShippingSettings()
      .then(setCheckoutForm)
      .catch(() => toast.error('Failed to load GST & shipping settings'));

    fetchDelhiverySettings()
      .then(setDelhiveryForm)
      .catch(() => toast.error('Failed to load Delhivery settings'));

    fetchEmailSettings()
      .then(setEmailForm)
      .catch(() => toast.error('Failed to load email settings'));

    fetchSiteBanner()
      .then(setBannerForm)
      .catch(() => toast.error('Failed to load site banner'));

    fetchAiChatSettings()
      .then(setAiChatForm)
      .catch(() => toast.error('Failed to load AI chat settings'));

    fetchSocialLinks()
      .then(setSocialForm)
      .catch(() => toast.error('Failed to load social media links'));
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      await saveStoreInfo(form);
      toast.success('Store settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const onSubmitCheckout = async (e: FormEvent) => {
    e.preventDefault();
    if (!checkoutForm) return;
    setSavingCheckout(true);
    try {
      await saveShippingSettings(checkoutForm);
      toast.success('GST & shipping settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingCheckout(false);
    }
  };

  const onSubmitDelhivery = async (e: FormEvent) => {
    e.preventDefault();
    if (!delhiveryForm) return;
    setSavingDelhivery(true);
    try {
      await saveDelhiverySettings(delhiveryForm);
      toast.success('Delhivery settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingDelhivery(false);
    }
  };

  const onSubmitAiChat = async (e: FormEvent) => {
    e.preventDefault();
    if (!aiChatForm) return;
    setSavingAiChat(true);
    try {
      await saveAiChatSettings(aiChatForm);
      toast.success('AI chat settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingAiChat(false);
    }
  };

  const onSubmitSocial = async (e: FormEvent) => {
    e.preventDefault();
    if (!socialForm) return;
    setSavingSocial(true);
    try {
      await saveSocialLinks(socialForm);
      toast.success('Social media links saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingSocial(false);
    }
  };

  const onTestAiChat = async () => {
    setTestingAiChat(true);
    setAiTestResult(null);
    try {
      const res = await fetch('/api/admin/ai-chat-test', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      setAiTestResult(data);
      if (!data.keyPresent) {
        toast.error('NVIDIA_API_KEY is missing on this deployment');
      } else if (data.results?.every((r: any) => r.ok)) {
        toast.success('AI connection is working');
      } else {
        toast.error('AI connection test found a problem — see details below');
      }
    } catch (err) {
      toast.error('Could not run the test');
      setAiTestResult({ keyPresent: null, results: [], summary: 'Request to /api/admin/ai-chat-test failed.' });
    } finally {
      setTestingAiChat(false);
    }
  };

  const onSubmitEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (!emailForm) return;
    setSavingEmail(true);
    try {
      await saveEmailSettings(emailForm);
      toast.success('Email settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingEmail(false);
    }
  };

  const saveBanner = async (next: SiteBanner) => {
    setBannerForm(next);
    setSavingBanner(true);
    try {
      await saveSiteBanner(next);
      toast.success('Site banner saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingBanner(false);
    }
  };

  const onUploadBanner = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !bannerForm) return;
    setUploadingBanner(true);
    try {
      const url = await uploadProductImage(file);
      await saveBanner({ ...bannerForm, image_url: url });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Banner upload failed');
    } finally {
      setUploadingBanner(false);
      e.target.value = '';
    }
  };

  const removeBanner = () => {
    if (!bannerForm) return;
    saveBanner({ ...bannerForm, image_url: '' });
  };

  const onSendTestEmail = async () => {
    if (!testEmailTo.trim()) {
      toast.error('Enter an email address to send the test to');
      return;
    }
    setSendingTest(true);
    try {
      const res = await fetch('/api/admin/settings/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testEmailTo.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success('Test email sent — check the inbox (and spam folder)');
      } else {
        toast.error(body.error || 'Failed to send test email');
      }
    } catch {
      toast.error('Failed to send test email');
    } finally {
      setSendingTest(false);
    }
  };

  if (loading || !form) {
    return <p className="py-8 text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">Admin</p>
        <h1 className="mt-1 font-serif text-3xl font-bold text-primary sm:text-4xl">Store Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This info appears on GST invoices and customer-facing pages — no code or SQL needed.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="grid max-w-xl gap-4 rounded-lg border border-border/60 bg-card p-5"
      >
        <div className="grid gap-1.5">
          <Label htmlFor="store-name">Store name</Label>
          <Input
            id="store-name"
            value={form.name}
            onChange={(e) => setForm((f) => f && { ...f, name: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="store-address">Store address</Label>
          <Textarea
            id="store-address"
            rows={2}
            value={form.address}
            onChange={(e) => setForm((f) => f && { ...f, address: e.target.value })}
            placeholder="Shop no., street, city, state, PIN"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="store-gstin">GSTIN</Label>
          <Input
            id="store-gstin"
            value={form.gstin}
            onChange={(e) => setForm((f) => f && { ...f, gstin: e.target.value.toUpperCase() })}
            placeholder="27ABCDE1234F1Z5"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="store-email">Support email</Label>
            <Input
              id="store-email"
              type="email"
              value={form.support_email}
              onChange={(e) => setForm((f) => f && { ...f, support_email: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="store-phone">Support phone</Label>
            <Input
              id="store-phone"
              value={form.support_phone}
              onChange={(e) => setForm((f) => f && { ...f, support_phone: e.target.value })}
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="store-whatsapp">WhatsApp number (optional)</Label>
          <Input
            id="store-whatsapp"
            value={form.whatsapp_number ?? ''}
            onChange={(e) => setForm((f) => f && { ...f, whatsapp_number: e.target.value })}
          />
        </div>
        <Button type="submit" disabled={saving} className="mt-2 w-fit bg-primary">
          <Save className="mr-1.5 h-4 w-4" /> {saving ? 'Saving…' : 'Save Settings'}
        </Button>
      </form>

      <div className="mt-8">
        <h2 className="font-serif text-2xl font-bold text-primary">Social Media Links</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste the full profile link for each platform you use. Leave any field blank
          to hide that icon on the storefront footer — no code needed.
        </p>
      </div>

      {!socialForm ? (
        <p className="py-4 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <form
          onSubmit={onSubmitSocial}
          className="mt-4 grid max-w-xl gap-4 rounded-lg border border-border/60 bg-card p-5"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="social-instagram">Instagram</Label>
            <Input
              id="social-instagram"
              value={socialForm.instagram}
              onChange={(e) => setSocialForm((f) => f && { ...f, instagram: e.target.value })}
              placeholder="https://instagram.com/aruhihandlooms"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="social-facebook">Facebook</Label>
            <Input
              id="social-facebook"
              value={socialForm.facebook}
              onChange={(e) => setSocialForm((f) => f && { ...f, facebook: e.target.value })}
              placeholder="https://facebook.com/aruhihandlooms"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="social-youtube">YouTube</Label>
            <Input
              id="social-youtube"
              value={socialForm.youtube}
              onChange={(e) => setSocialForm((f) => f && { ...f, youtube: e.target.value })}
              placeholder="https://youtube.com/@aruhihandlooms"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="social-twitter">Twitter / X</Label>
            <Input
              id="social-twitter"
              value={socialForm.twitter}
              onChange={(e) => setSocialForm((f) => f && { ...f, twitter: e.target.value })}
              placeholder="https://x.com/aruhihandlooms"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="social-linkedin">LinkedIn</Label>
            <Input
              id="social-linkedin"
              value={socialForm.linkedin}
              onChange={(e) => setSocialForm((f) => f && { ...f, linkedin: e.target.value })}
              placeholder="https://linkedin.com/company/aruhihandlooms"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="social-whatsapp">WhatsApp</Label>
            <Input
              id="social-whatsapp"
              value={socialForm.whatsapp}
              onChange={(e) => setSocialForm((f) => f && { ...f, whatsapp: e.target.value })}
              placeholder="https://wa.me/918001234567"
            />
          </div>
          <Button type="submit" disabled={savingSocial} className="mt-2 w-fit bg-primary">
            <Save className="mr-1.5 h-4 w-4" /> {savingSocial ? 'Saving…' : 'Save Social Links'}
          </Button>
        </form>
      )}

      <div className="mt-8">
        <h2 className="font-serif text-2xl font-bold text-primary">Site Banner</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A promotional image shown at the top of every page (except checkout).
          Upload once and it appears storewide — no code needed.
        </p>
      </div>

      {!bannerForm ? (
        <p className="py-4 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="mt-4 grid max-w-xl gap-4 rounded-lg border border-border/60 bg-card p-5">
          <div className="grid gap-1.5">
            <Label>Banner image</Label>
            {bannerForm.image_url ? (
              <div className="flex items-center gap-3">
                <div className="relative h-16 w-32 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                  <Image
                    src={bannerForm.image_url}
                    alt="Site banner preview"
                    fill
                    sizes="128px"
                    className="object-cover"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={removeBanner}
                  disabled={savingBanner}
                  className="gap-1.5 text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove banner
                </Button>
              </div>
            ) : (
              <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-dashed border-border bg-muted/40 px-4 py-2 text-sm hover:border-primary/50">
                {uploadingBanner ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                <span>{uploadingBanner ? 'Uploading…' : 'Upload banner image'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onUploadBanner}
                  disabled={uploadingBanner}
                />
              </label>
            )}
            <p className="text-xs text-muted-foreground">
              Wide images work best (e.g. 1600×400). Shows on every page except checkout.
              Remove it and the banner just disappears storewide.
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="banner-link">Link (optional)</Label>
            <Input
              id="banner-link"
              value={bannerForm.link_url ?? ''}
              onChange={(e) => setBannerForm((f) => f && { ...f, link_url: e.target.value })}
              onBlur={() => bannerForm && saveBanner(bannerForm)}
              placeholder="/shop?category=Bridal"
            />
            <p className="text-xs text-muted-foreground">
              Where the banner takes people if they click it. Leave blank for a non-clickable banner.
            </p>
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="font-serif text-2xl font-bold text-primary">GST & Shipping</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Controls the tax rate and shipping fee applied at checkout storewide.
        </p>
      </div>

      {!checkoutForm ? (
        <p className="py-4 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <form
          onSubmit={onSubmitCheckout}
          className="mt-4 grid max-w-xl gap-4 rounded-lg border border-border/60 bg-card p-5"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="gst-rate">GST rate (%)</Label>
            <Input
              id="gst-rate"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={checkoutForm.gst_rate_percent}
              onChange={(e) =>
                setCheckoutForm(
                  (f) => f && { ...f, gst_rate_percent: Number(e.target.value) }
                )
              }
            />
            <p className="text-xs text-muted-foreground">
              Applied to the discounted subtotal at checkout, e.g. 5 = 5% GST.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="shipping-fee">Shipping fee (₹)</Label>
              <Input
                id="shipping-fee"
                type="number"
                min={0}
                step="1"
                value={checkoutForm.flat_rate}
                onChange={(e) =>
                  setCheckoutForm(
                    (f) => f && { ...f, flat_rate: Number(e.target.value) }
                  )
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="free-shipping-threshold">Free shipping above (₹)</Label>
              <Input
                id="free-shipping-threshold"
                type="number"
                min={0}
                step="1"
                value={checkoutForm.free_shipping_threshold}
                onChange={(e) =>
                  setCheckoutForm(
                    (f) => f && { ...f, free_shipping_threshold: Number(e.target.value) }
                  )
                }
              />
              <p className="text-xs text-muted-foreground">
                Set to 0 to always charge the shipping fee.
              </p>
            </div>
          </div>
          <Button type="submit" disabled={savingCheckout} className="mt-2 w-fit bg-primary">
            <Save className="mr-1.5 h-4 w-4" />{' '}
            {savingCheckout ? 'Saving…' : 'Save GST & Shipping'}
          </Button>
        </form>
      )}

      <div className="mt-8">
        <h2 className="font-serif text-2xl font-bold text-primary">Delhivery Courier</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Auto-create shipments and show live tracking on order pages once an order ships.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          The API token is a secret and is read from the <code>DELHIVERY_API_TOKEN</code>{' '}
          environment variable on your server (Vercel → Settings → Environment Variables) — not
          from this form. Everything below is your pickup warehouse info, which is safe to store
          here.
        </p>
      </div>

      {!delhiveryForm ? (
        <p className="py-4 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <form
          onSubmit={onSubmitDelhivery}
          className="mt-4 grid max-w-xl gap-4 rounded-lg border border-border/60 bg-card p-5"
        >
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={delhiveryForm.enabled}
              onChange={(e) =>
                setDelhiveryForm((f) => f && { ...f, enabled: e.target.checked })
              }
              className="h-4 w-4"
            />
            Enable Delhivery integration
          </label>

          <div className="grid gap-1.5">
            <Label htmlFor="dl-location-name">Pickup location name</Label>
            <Input
              id="dl-location-name"
              value={delhiveryForm.pickup_location_name}
              onChange={(e) =>
                setDelhiveryForm((f) => f && { ...f, pickup_location_name: e.target.value })
              }
              placeholder="Must exactly match the warehouse name in your Delhivery dashboard"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="dl-pincode">Pickup PIN code</Label>
              <Input
                id="dl-pincode"
                value={delhiveryForm.pickup_pincode}
                onChange={(e) =>
                  setDelhiveryForm((f) => f && { ...f, pickup_pincode: e.target.value })
                }
                inputMode="numeric"
                placeholder="400050"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="dl-phone">Pickup phone</Label>
              <Input
                id="dl-phone"
                value={delhiveryForm.pickup_phone}
                onChange={(e) =>
                  setDelhiveryForm((f) => f && { ...f, pickup_phone: e.target.value })
                }
                placeholder="+91 98765 43210"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="dl-address">Pickup address</Label>
            <Textarea
              id="dl-address"
              rows={2}
              value={delhiveryForm.pickup_address}
              onChange={(e) =>
                setDelhiveryForm((f) => f && { ...f, pickup_address: e.target.value })
              }
              placeholder="Warehouse address"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="dl-city">City</Label>
              <Input
                id="dl-city"
                value={delhiveryForm.pickup_city}
                onChange={(e) =>
                  setDelhiveryForm((f) => f && { ...f, pickup_city: e.target.value })
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="dl-state">State</Label>
              <Input
                id="dl-state"
                value={delhiveryForm.pickup_state}
                onChange={(e) =>
                  setDelhiveryForm((f) => f && { ...f, pickup_state: e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="dl-gst">Seller GST TIN</Label>
            <Input
              id="dl-gst"
              value={delhiveryForm.seller_gst_tin}
              onChange={(e) =>
                setDelhiveryForm(
                  (f) => f && { ...f, seller_gst_tin: e.target.value.toUpperCase() }
                )
              }
              placeholder="27ABCDE1234F1Z5"
            />
          </div>

          <Button type="submit" disabled={savingDelhivery} className="mt-2 w-fit bg-primary">
            <Save className="mr-1.5 h-4 w-4" />{' '}
            {savingDelhivery ? 'Saving…' : 'Save Delhivery Settings'}
          </Button>
        </form>
      )}

      <div className="mt-8">
        <h2 className="font-serif text-2xl font-bold text-primary">AI Chat Assistant</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Powers the free-text "Ask me anything" box in the on-site chat widget (order tracking,
          sizing, delivery, returns questions). If replies stop working or feel slow, switching the
          model here usually fixes it — no redeploy needed.
        </p>
      </div>

      {!aiChatForm ? (
        <p className="py-4 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <form
          onSubmit={onSubmitAiChat}
          className="mt-4 grid max-w-xl gap-4 rounded-lg border border-border/60 bg-card p-5"
        >
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={aiChatForm.enabled}
              onChange={(e) => setAiChatForm((f) => f && { ...f, enabled: e.target.checked })}
            />
            Enable free-text AI chat (quick-reply topic buttons always stay on regardless)
          </label>

          <div className="grid gap-1.5">
            <Label htmlFor="ai-primary-model">Primary model</Label>
            <select
              id="ai-primary-model"
              value={aiChatForm.primary_model}
              onChange={(e) => setAiChatForm((f) => f && { ...f, primary_model: e.target.value })}
              className="rounded border px-3 py-2 text-sm"
            >
              {AI_CHAT_MODEL_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="ai-fallback-model">Fallback model</Label>
            <select
              id="ai-fallback-model"
              value={aiChatForm.fallback_model}
              onChange={(e) => setAiChatForm((f) => f && { ...f, fallback_model: e.target.value })}
              className="rounded border px-3 py-2 text-sm"
            >
              {AI_CHAT_MODEL_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Used automatically if the primary model errors, times out, or is rate-limited on your
              NVIDIA_API_KEY account. Even if both fail, order tracking questions still get a real
              answer — the widget's "Track my order" button reads live order/courier data directly,
              without needing the AI at all.
            </p>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={savingAiChat} className="w-fit bg-primary">
              <Save className="mr-1.5 h-4 w-4" /> {savingAiChat ? 'Saving…' : 'Save AI Chat Settings'}
            </Button>
            <Button type="button" variant="outline" disabled={testingAiChat} onClick={onTestAiChat}>
              {testingAiChat ? 'Testing…' : 'Test AI connection'}
            </Button>
          </div>

          {aiTestResult && (
            <div className="mt-2 grid gap-2 rounded-lg border border-border/60 bg-muted/40 p-4 text-sm">
              {aiTestResult.summary && (
                <p className="font-medium text-destructive">{aiTestResult.summary}</p>
              )}
              {aiTestResult.keyPresent && (
                <p className="text-xs text-muted-foreground">
                  Using key {aiTestResult.keyPreview} · AI chat enabled: {String(aiTestResult.aiChatEnabled)}
                </p>
              )}
              {(aiTestResult.results || []).map((r: any) => (
                <div
                  key={r.model}
                  className={`rounded border p-3 ${r.ok ? 'border-emerald-300 bg-emerald-50' : 'border-destructive/40 bg-destructive/5'}`}
                >
                  <p className="font-mono text-xs font-semibold">{r.model}</p>
                  {r.ok ? (
                    <p className="mt-1 text-xs text-emerald-800">
                      ✅ Working ({r.ms}ms) — model replied: &quot;{r.reply}&quot;
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-destructive">
                      ❌ HTTP {r.httpStatus || 'network error'} ({r.ms}ms) — {r.errorDetail}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </form>
      )}

      <div className="mt-8">
        <h2 className="font-serif text-2xl font-bold text-primary">Email Notifications</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Powers order confirmation, shipping, return-status, and abandoned-cart recovery emails.
        </p>
      </div>

      {!emailForm ? (
        <p className="py-4 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <form
          onSubmit={onSubmitEmail}
          className="mt-4 grid max-w-xl gap-4 rounded-lg border border-border/60 bg-card p-5"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="email-provider">Provider</Label>
            <select
              id="email-provider"
              value={emailForm.provider}
              onChange={(e) =>
                setEmailForm((f) => f && { ...f, provider: e.target.value as EmailSettings['provider'] })
              }
              className="rounded border px-3 py-2 text-sm"
            >
              <option value="">Not configured</option>
              <option value="resend">Resend</option>
              <option value="zeptomail">Zoho ZeptoMail</option>
            </select>
          </div>

          {emailForm.provider === 'zeptomail' && (
            <div className="grid gap-1.5">
              <Label htmlFor="zeptomail-region">ZeptoMail account region</Label>
              <select
                id="zeptomail-region"
                value={emailForm.zeptomail_region}
                onChange={(e) =>
                  setEmailForm((f) => f && { ...f, zeptomail_region: e.target.value as 'in' | 'com' })
                }
                className="rounded border px-3 py-2 text-sm"
              >
                <option value="in">India (zeptomail.in)</option>
                <option value="com">Global (zeptomail.com)</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Check your ZeptoMail dashboard URL — zoho.in accounts use the India API, zoho.com uses Global.
              </p>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="email-api-key">
              {emailForm.provider === 'zeptomail' ? 'ZeptoMail API token (Send Mail token)' : 'Resend API key'}
            </Label>
            <Input
              id="email-api-key"
              type="password"
              value={emailForm.api_key}
              onChange={(e) => setEmailForm((f) => f && { ...f, api_key: e.target.value })}
              placeholder={emailForm.provider === 'zeptomail' ? 'Zoho-enczapikey PHtE6r1a...' : 're_xxxxxxxxxxxx'}
            />
            <p className="text-xs text-muted-foreground">
              {emailForm.provider === 'zeptomail'
                ? 'Zoho Mail Admin → ZeptoMail → Mail Agents → your agent → API tokens. Paste the whole token, including the "Zoho-enczapikey " prefix if shown.'
                : 'From resend.com/api-keys.'}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="email-sender-name">From name</Label>
              <Input
                id="email-sender-name"
                value={emailForm.sender_name}
                onChange={(e) => setEmailForm((f) => f && { ...f, sender_name: e.target.value })}
                placeholder="Aruhi Handlooms"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="email-sender-address">From email address</Label>
              <Input
                id="email-sender-address"
                type="email"
                value={emailForm.sender_email}
                onChange={(e) => setEmailForm((f) => f && { ...f, sender_email: e.target.value })}
                placeholder="orders@yourdomain.com"
              />
              <p className="text-xs text-muted-foreground">
                Must be on a domain you've verified with your provider (or Resend's sandbox address
                onboarding@resend.dev, which only delivers to your own signup email).
              </p>
            </div>
          </div>

          <Button type="submit" disabled={savingEmail} className="mt-2 w-fit bg-primary">
            <Save className="mr-1.5 h-4 w-4" /> {savingEmail ? 'Saving…' : 'Save Email Settings'}
          </Button>

          <div className="mt-2 flex flex-col gap-2 border-t border-border/60 pt-4 sm:flex-row sm:items-center">
            <Input
              value={testEmailTo}
              onChange={(e) => setTestEmailTo(e.target.value)}
              type="email"
              placeholder="you@example.com"
              className="sm:max-w-xs"
            />
            <Button type="button" variant="outline" disabled={sendingTest} onClick={onSendTestEmail}>
              {sendingTest ? 'Sending…' : 'Send test email'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
