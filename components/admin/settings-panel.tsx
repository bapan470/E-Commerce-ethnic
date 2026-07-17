'use client';

import { useEffect, useState, FormEvent } from 'react';
import { Save } from 'lucide-react';
import { StoreInfo, fetchStoreInfo, saveStoreInfo } from '@/lib/settings-api';
import {
  ShippingSettings,
  fetchShippingSettings,
  saveShippingSettings,
} from '@/lib/pincode-api';
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

  useEffect(() => {
    fetchStoreInfo()
      .then(setForm)
      .catch(() => toast.error('Failed to load store settings'))
      .finally(() => setLoading(false));

    fetchShippingSettings()
      .then(setCheckoutForm)
      .catch(() => toast.error('Failed to load GST & shipping settings'));
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
    </div>
  );
}
