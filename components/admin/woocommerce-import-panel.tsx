'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, Send, Trash2, Search, Sparkles, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  fetchImportedCustomers,
  importWooCommerceCustomersChunk,
  deleteImportedCustomer,
  sendWooCommerceCampaign,
  fetchFeaturedProducts,
  fetchCampaignHistory,
  type ImportedCustomer,
  type CampaignHistoryEntry,
  type CampaignCategoryOption,
} from '@/lib/woocommerce-import-api';
import {
  buildPremiumCampaignHtml,
  CAMPAIGN_TEMPLATES,
  TRACKING_PIXEL_PLACEHOLDER,
  type CampaignTemplateId,
} from '@/lib/campaign-templates';

export default function WooCommerceImportPanel() {
  const [customers, setCustomers] = useState<ImportedCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [sending, setSending] = useState(false);

  const [storeUrl, setStoreUrl] = useState('');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  // Premium template picker: when a template is applied, `message` holds
  // full ready-to-send HTML (built from real products) instead of plain
  // text. Detected by content (starts with <!DOCTYPE/<html) rather than a
  // separate boolean, so direct HTML edits after applying a template still
  // send correctly without extra state to keep in sync.
  const isPremiumHtml = /^\s*<(!doctype|html)/i.test(message);
  const [applyingTemplate, setApplyingTemplate] = useState<CampaignTemplateId | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const [history, setHistory] = useState<CampaignHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [availableCategories, setAvailableCategories] = useState<CampaignCategoryOption[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('__all__');

  const loadHistory = () =>
    fetchCampaignHistory()
      .then(setHistory)
      .catch(() => {})
      .finally(() => setHistoryLoading(false));

  const load = () =>
    fetchImportedCustomers()
      .then(setCustomers)
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    loadHistory();
    fetchFeaturedProducts(1)
      .then(({ categories }) => setAvailableCategories(categories))
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        (c.name ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.phone ?? '').toLowerCase().includes(q)
    );
  }, [customers, search]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filtered.forEach((c) => next.delete(c.id));
      } else {
        filtered.forEach((c) => next.add(c.id));
      }
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleImport = async () => {
    if (!storeUrl || !consumerKey || !consumerSecret) {
      toast.error('Store URL, Consumer Key aur Consumer Secret teeno bharo');
      return;
    }
    setImporting(true);
    let totalOrders = 0;
    try {
      for (;;) {
        setImportProgress(
          totalOrders === 0 ? 'Shuru ho raha hai...' : `${totalOrders} orders scan ho chuke hain...`
        );
        // reset is always false here: the server keeps a saved cursor keyed
        // to this storeUrl, so clicking Import again (e.g. after a timeout)
        // automatically resumes from where it left off instead of
        // restarting from page 1. A different storeUrl gets a fresh start
        // automatically too, since the saved cursor won't match it.
        const result = await importWooCommerceCustomersChunk({
          storeUrl,
          consumerKey,
          consumerSecret,
          reset: false,
        });
        totalOrders += result.ordersScanned;
        await load(); // refresh the list so progress is visible as it goes
        if (result.done) {
          if (result.warning) {
            toast.error(result.warning, { duration: 15000 });
          } else {
            toast.success(`Import complete — ${totalOrders} orders scan hue`);
          }
          break;
        }
      }
    } catch (err) {
      toast.error(
        (err instanceof Error ? err.message : 'Import fail ho gaya') +
          ' — dubara "Import Customers" dabao, jaha ruka tha wahi se continue hoga.'
      );
    } finally {
      setImporting(false);
      setImportProgress('');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteImportedCustomer(id);
      setCustomers((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete fail ho gaya');
    }
  };

  const applyTemplate = async (templateId: CampaignTemplateId) => {
    setApplyingTemplate(templateId);
    try {
      const categoryFilter = selectedCategory === '__all__' ? undefined : selectedCategory;
      const { products, categories } = await fetchFeaturedProducts(6, categoryFilter);
      setAvailableCategories(categories); // keeps the dropdown's options fresh/live
      if (products.length === 0) {
        toast.error(
          categoryFilter
            ? `"${categoryFilter}" category me koi in-stock product (image ke saath) nahi mila`
            : 'Koi in-stock product (image ke saath) nahi mila is store me'
        );
        return;
      }
      const templateMeta = CAMPAIGN_TEMPLATES.find((t) => t.id === templateId)!;
      const headline =
        templateId === 'festive'
          ? categoryFilter
            ? `${categoryFilter} — Now At Special Prices`
            : 'Handpicked Sarees, Now At Special Prices'
          : templateId === 'new-arrivals'
            ? categoryFilter
              ? `New In ${categoryFilter}`
              : 'Fresh Off The Loom — New Arrivals'
            : `A Note From ${'AruhiHandlooms'}`;
      const html = buildPremiumCampaignHtml({
        templateId,
        headline,
        subheadline:
          templateId === 'minimal'
            ? 'Handpicked ethnic wear, woven by master craftsmen across India.'
            : 'Handpicked pieces our customers love — real photos, real stock, click to shop instantly.',
        discountBadge: templateId === 'festive' ? 'LIMITED TIME OFFER' : undefined,
        heroImage: templateId === 'festive' && heroImageUrl.trim() ? heroImageUrl.trim() : undefined,
        products,
        categories, // renders the "Shop by Category" circle row, same as homepage
      });
      setMessage(html);
      if (!subject.trim()) setSubject(headline);
      toast.success(`${templateMeta.label} template laga diya (${products.length} real products ke saath)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Template load nahi ho paya');
    } finally {
      setApplyingTemplate(null);
    }
  };

  const handleSend = async () => {
    if (selected.size === 0) {
      toast.error('Kam se kam ek customer select karo');
      return;
    }
    if (!subject.trim() || !message.trim()) {
      toast.error('Subject aur message dono likho');
      return;
    }
    setSending(true);
    try {
      const html = isPremiumHtml
        ? message
        : `<div style="font-family:sans-serif;font-size:15px;line-height:1.6">${message.replace(
            /\n/g,
            '<br/>'
          )}<hr style="margin-top:24px"/><p style="font-size:12px;color:#888">You're receiving this email because you previously purchased from one of our partner stores. If you'd rather not get emails like this, just reply and let us know and we'll remove you.${TRACKING_PIXEL_PLACEHOLDER}</p></div>`;
      const result = await sendWooCommerceCampaign({
        customerIds: Array.from(selected),
        subject,
        html,
      });
      toast.success(`Sent: ${result.sent}, Skipped: ${result.skipped}, Failed: ${result.failed}`);
      loadHistory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Campaign send fail ho gaya');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">Admin</p>
        <h1 className="text-2xl font-serif font-semibold">WooCommerce Customer Import</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Apne WooCommerce store ke <strong>real orders</strong> se customer name, email, phone
          yahan la kar unhe email marketing bhejo. Ye sirf un logon ko import karta hai jinhone
          kabhi order kiya ho — WordPress ke fake/spam registered users kabhi include nahi
          honge. Sirf apne khud ke store ka data import karo, aur emails me hamesha opt-out ka
          option rakho.
        </p>
      </div>

      {/* Connect form */}
      <div className="rounded-lg border p-4 grid gap-3 max-w-xl">
        <h2 className="font-medium">1. WooCommerce se connect karo</h2>
        <Input
          placeholder="Store URL (e.g. https://mystore.com)"
          value={storeUrl}
          onChange={(e) => setStoreUrl(e.target.value)}
        />
        <Input
          placeholder="Consumer Key (ck_...)"
          value={consumerKey}
          onChange={(e) => setConsumerKey(e.target.value)}
        />
        <Input
          type="password"
          placeholder="Consumer Secret (cs_...)"
          value={consumerSecret}
          onChange={(e) => setConsumerSecret(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Ye WooCommerce me milta hai: WordPress Admin → WooCommerce → Settings → Advanced →
          REST API → "Add key" (Permissions: Read).
        </p>
        <Button onClick={handleImport} disabled={importing} className="gap-2 w-fit">
          <Download className="h-4 w-4" />
          {importing ? importProgress || 'Import ho raha hai...' : 'Import Customers'}
        </Button>
      </div>

      {/* Imported list + campaign composer */}
      <div className="rounded-lg border p-4 grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">2. Imported customers ({customers.length})</h2>
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search name/email/phone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Abhi koi customer import nahi hua.</p>
        ) : (
          <div className="max-h-80 overflow-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="p-2 text-left">
                    <Checkbox checked={allFilteredSelected} onCheckedChange={toggleAll} />
                  </th>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Email</th>
                  <th className="p-2 text-left">Phone</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="p-2">
                      <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleOne(c.id)} />
                    </td>
                    <td className="p-2">{c.name || '—'}</td>
                    <td className="p-2">{c.email || '—'}</td>
                    <td className="p-2">{c.phone || '—'}</td>
                    <td className="p-2 text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h2 className="font-medium">3. Email campaign bhejo ({selected.size} selected)</h2>

        <div className="rounded-md border bg-muted/30 p-3 grid gap-2">
          <p className="text-xs font-medium flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5" /> Premium template (asli products, clickable)
          </p>
          <Input
            placeholder="Hero banner image URL (optional — Festive template ke top pe dikhega, jaisa homepage pe hai)"
            value={heroImageUrl}
            onChange={(e) => setHeroImageUrl(e.target.value)}
            className="text-xs"
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Category filter:</span>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="h-8 w-56 text-xs">
                <SelectValue placeholder="Sabhi categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Sabhi categories (featured/latest)</SelectItem>
                {availableCategories.map((c) => (
                  <SelectItem key={c.slug} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            {CAMPAIGN_TEMPLATES.map((t) => (
              <Button
                key={t.id}
                type="button"
                variant="outline"
                size="sm"
                disabled={applyingTemplate !== null}
                onClick={() => applyTemplate(t.id)}
                title={t.description}
              >
                {applyingTemplate === t.id ? 'Loading...' : t.label}
              </Button>
            ))}
            {isPremiumHtml && (
              <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={() => setShowPreview((s) => !s)}>
                <Eye className="h-3.5 w-3.5" /> {showPreview ? 'Preview hide karo' : 'Preview dekho'}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Ek click me tumhare store ke real in-stock products (photo, naam, price) aur
            categories (round photo, jaisa homepage pe hai) se poora template ban jayega — har
            category aur product click karne par uske asli page pe khulega. Upar se ek category
            chun ke products sirf usi category ke dikha sakte ho (default: featured/latest sabse).
            Hero banner me ek <strong>animated .gif</strong> ka URL bhi daal sakte ho (jo 2-3 banners
            cycle kare) — asli JS carousel to email me nahi chalta, lekin GIF sabse close alternative hai.
          </p>
        </div>

        {showPreview && isPremiumHtml && (
          <iframe
            title="Email preview"
            srcDoc={message.replace(TRACKING_PIXEL_PLACEHOLDER, '')}
            className="w-full h-96 rounded border bg-white"
          />
        )}

        <Input placeholder="Subject line" value={subject} onChange={(e) => setSubject(e.target.value)} />
        {isPremiumHtml && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
            Premium template active hai (HTML source niche dikh raha hai) — "Preview dekho" se
            visual check karo. Niche direct HTML edit bhi kar sakte ho.
          </p>
        )}
        <Textarea
          placeholder="Message likho... (ya upar se ek premium template chuno)"
          rows={isPremiumHtml ? 10 : 6}
          className={isPremiumHtml ? 'font-mono text-xs' : undefined}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />

        <p className="text-xs text-muted-foreground">
          Email bhejne ke liye Admin → Settings → Email Notifications me pehle Resend ya
          ZeptoMail configure karo, warna send fail hoga.
        </p>
        <Button onClick={handleSend} disabled={sending} className="gap-2 w-fit">
          <Send className="h-4 w-4" />
          {sending ? 'Bhej raha hai...' : `Send to ${selected.size} customers`}
        </Button>
      </div>

      {/* Campaign history + open tracking */}
      <div className="rounded-lg border p-4 grid gap-3">
        <h2 className="font-medium">4. Pehle bheji gayi campaigns (open tracking)</h2>
        {historyLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Abhi tak koi campaign nahi bheji gayi.</p>
        ) : (
          <div className="overflow-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-2 text-left">Subject</th>
                  <th className="p-2 text-right">Sent</th>
                  <th className="p-2 text-right">Opened</th>
                  <th className="p-2 text-right">Open rate</th>
                  <th className="p-2 text-right">Failed</th>
                  <th className="p-2 text-left">Last sent</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.subject} className="border-t">
                    <td className="p-2">{h.subject}</td>
                    <td className="p-2 text-right">{h.sent}</td>
                    <td className="p-2 text-right">{h.opened}</td>
                    <td className="p-2 text-right">
                      {h.sent > 0 ? `${Math.round((h.opened / h.sent) * 100)}%` : '—'}
                    </td>
                    <td className="p-2 text-right">{h.failed}</td>
                    <td className="p-2">{new Date(h.lastSentAt).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
