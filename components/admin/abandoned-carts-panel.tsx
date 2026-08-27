'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  ShoppingCart,
  Mail,
  MessageCircle,
  CheckCircle2,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  MailOpen,
  MousePointerClick,
  Settings2,
  Save,
} from 'lucide-react';
import { formatINR } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

type AbandonedCart = {
  id: string;
  email: string | null;
  phone: string | null;
  items: any[];
  cart_value: number;
  last_activity_at: string;
  recovery_email_sent: boolean;
  recovery_email_sent_at?: string | null;
  recovery_stage?: number;
  recovered: boolean;
};

type CartEmailLogEntry = {
  id: string;
  sequence_number: number;
  subject: string;
  coupon_code: string | null;
  sent_at: string;
  opened_at: string | null;
  open_count: number;
  clicked_at: string | null;
  click_count: number;
  converted: boolean;
  converted_at: string | null;
};

type SequenceStep = {
  enabled: boolean;
  delay_hours: number;
  subject: string;
  html: string;
  coupon_code: string;
};

type SequenceSettings = {
  enabled: boolean;
  steps: SequenceStep[];
};

const DEFAULT_SEQUENCE_SETTINGS: SequenceSettings = {
  enabled: true,
  steps: [
    { enabled: true, delay_hours: 1, subject: '', html: '', coupon_code: '' },
    { enabled: true, delay_hours: 24, subject: '', html: '', coupon_code: '' },
    { enabled: true, delay_hours: 72, subject: '', html: '', coupon_code: '' },
  ],
};

const STEP_LABELS = ['1st email', '2nd email', '3rd email'];

// Builds a free wa.me click-to-chat link — no WhatsApp Business API / BSP
// involved, so no per-message Meta billing. Opening it starts a chat from
// whichever WhatsApp (Web or app) the admin is logged into, with the
// recovery message already typed in; the admin just taps Send. Returns
// null if the stored phone number doesn't look like a valid 10-digit
// Indian mobile number, so the button can hide itself instead of building
// a broken link.
function buildWhatsAppRecoveryLink(phone: string, cartValue: number): string | null {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);
  if (!/^[6-9][0-9]{9}$/.test(digits)) return null;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.aruhihandlooms.com';
  const message =
    `Hi! You left some beautiful pieces in your AruhiHandlooms cart` +
    (cartValue ? ` (worth ${formatINR(cartValue)})` : '') +
    `. Complete your order here: ${siteUrl}/cart`;

  return `https://wa.me/91${digits}?text=${encodeURIComponent(message)}`;
}

function EmailStatusBadges({ e }: { e: CartEmailLogEntry }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant="outline" className="gap-1 text-emerald-700 border-emerald-200 bg-emerald-50">
        <Mail className="h-3 w-3" /> Sent
      </Badge>
      {e.opened_at ? (
        <Badge variant="outline" className="gap-1 text-blue-700 border-blue-200 bg-blue-50">
          <MailOpen className="h-3 w-3" /> Opened{e.open_count > 1 ? ` ×${e.open_count}` : ''}
        </Badge>
      ) : (
        <Badge variant="outline" className="text-muted-foreground">
          Not opened
        </Badge>
      )}
      {e.clicked_at && (
        <Badge variant="outline" className="gap-1 text-purple-700 border-purple-200 bg-purple-50">
          <MousePointerClick className="h-3 w-3" /> Clicked{e.click_count > 1 ? ` ×${e.click_count}` : ''}
        </Badge>
      )}
      {e.converted && (
        <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
          <CheckCircle2 className="h-3 w-3" /> Converted
        </Badge>
      )}
    </div>
  );
}

function CartEmailHistory({ cartId }: { cartId: string }) {
  const [emails, setEmails] = useState<CartEmailLogEntry[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/abandoned-carts/${cartId}/emails`);
        const body = await res.json().catch(() => ({}));
        if (!cancelled) setEmails(res.ok ? body.emails || [] : []);
      } catch {
        if (!cancelled) setEmails([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cartId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading email history…
      </div>
    );
  }

  if (!emails || emails.length === 0) {
    return <p className="py-3 text-sm text-muted-foreground">No recovery emails sent for this cart yet.</p>;
  }

  return (
    <ul className="space-y-2 py-3">
      {emails.map((e) => (
        <li key={e.id} className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-medium">{STEP_LABELS[e.sequence_number - 1] || `Email ${e.sequence_number}`}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {new Date(e.sent_at).toLocaleString('en-IN')}
              </span>
            </div>
            <EmailStatusBadges e={e} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{e.subject}</p>
          {e.coupon_code && (
            <p className="mt-1 text-xs">
              Coupon: <span className="font-mono font-medium">{e.coupon_code}</span>
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function SendCustomEmailDialog({
  cart,
  open,
  onOpenChange,
  onSent,
}: {
  cart: AbandonedCart | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSent: () => void;
}) {
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setSubject('');
      setHtml('');
      setCouponCode('');
    }
  }, [open, cart?.id]);

  if (!cart) return null;
  const nextStage = (cart.recovery_stage || 0) + 1;

  const send = async () => {
    setSending(true);
    try {
      const res = await fetch(`/api/admin/abandoned-carts/${cart.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim() || undefined,
          html: html.trim() || undefined,
          coupon_code: couponCode.trim() || undefined,
        }),
      });
      if (res.ok) {
        toast.success('Recovery email sent');
        onOpenChange(false);
        onSent();
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || 'Failed to send email');
      }
    } catch {
      toast.error('Failed to send email');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send {STEP_LABELS[nextStage - 1] || `email ${nextStage}`} to {cart.email}</DialogTitle>
          <DialogDescription>
            Leave subject/message blank to use the default template for this step. This counts as this
            cart's next recovery email in the sequence.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Coupon code (optional)</Label>
            <Input
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              placeholder="e.g. SAVE10"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Create this code under Admin &gt; Coupons first so it actually works at checkout.
            </p>
          </div>
          <div>
            <Label>Custom subject (optional)</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Leave blank for the default subject"
            />
          </div>
          <div>
            <Label>Custom message HTML (optional)</Label>
            <Textarea
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              rows={8}
              placeholder={`Leave blank for the default template. You can use:\n{{items_table}}  {{cart_total}}  {{cart_url}}  {{coupon_code}}  {{coupon_line}}`}
              className="font-mono text-xs"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Merge fields: <code>{'{{items_table}}'}</code> <code>{'{{cart_total}}'}</code>{' '}
              <code>{'{{cart_url}}'}</code> <code>{'{{coupon_code}}'}</code> <code>{'{{coupon_line}}'}</code>
            </p>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button onClick={send} disabled={sending}>
            {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SequenceSettingsPanel() {
  const [settings, setSettings] = useState<SequenceSettings>(DEFAULT_SEQUENCE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/cart-recovery-settings');
        if (res.ok) {
          const body = await res.json();
          setSettings(body.settings || DEFAULT_SEQUENCE_SETTINGS);
        }
      } catch {
        toast.error('Failed to load sequence settings');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updateStep = (index: number, patch: Partial<SequenceStep>) => {
    setSettings((s) => ({
      ...s,
      steps: s.steps.map((step, i) => (i === index ? { ...step, ...patch } : step)) as SequenceStep[],
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/cart-recovery-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      if (res.ok) {
        toast.success('Sequence settings saved');
      } else {
        toast.error('Failed to save settings');
      }
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" /> Cart Recovery Sequence
            </span>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, enabled: v }))}
            />
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Runs once a day via the scheduled job. Turn this off to pause automatic sends entirely
            (manual "Send" from the Carts tab still works). Requires an email provider configured
            under Admin &gt; Settings &gt; Email Notifications.
          </p>
        </CardHeader>
      </Card>

      {settings.steps.map((step, i) => (
        <Card key={i}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              <span>{STEP_LABELS[i]}</span>
              <Switch checked={step.enabled} onCheckedChange={(v) => updateStep(i, { enabled: v })} />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>
                  Send {i === 0 ? 'after cart is abandoned for' : 'this many hours after the previous email'}
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={step.delay_hours}
                  onChange={(e) => updateStep(i, { delay_hours: Number(e.target.value) })}
                />
                <p className="mt-1 text-xs text-muted-foreground">Hours</p>
              </div>
              <div>
                <Label>Coupon code (optional)</Label>
                <Input
                  value={step.coupon_code}
                  onChange={(e) => updateStep(i, { coupon_code: e.target.value })}
                  placeholder="e.g. COMEBACK10"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Create it under Admin &gt; Coupons too.
                </p>
              </div>
            </div>
            <div>
              <Label>Custom subject (optional)</Label>
              <Input
                value={step.subject}
                onChange={(e) => updateStep(i, { subject: e.target.value })}
                placeholder="Leave blank for the default subject"
              />
            </div>
            <div>
              <Label>Custom message HTML (optional)</Label>
              <Textarea
                value={step.html}
                onChange={(e) => updateStep(i, { html: e.target.value })}
                rows={6}
                placeholder={`Leave blank for the default template. You can use:\n{{items_table}}  {{cart_total}}  {{cart_url}}  {{coupon_code}}  {{coupon_line}}`}
                className="font-mono text-xs"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Merge fields: <code>{'{{items_table}}'}</code> <code>{'{{cart_total}}'}</code>{' '}
                <code>{'{{cart_url}}'}</code> <code>{'{{coupon_code}}'}</code> <code>{'{{coupon_line}}'}</code>
              </p>
            </div>
          </CardContent>
        </Card>
      ))}

      <Button onClick={save} disabled={saving}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        {saving ? 'Saving…' : 'Save sequence settings'}
      </Button>
    </div>
  );
}

function CartsList() {
  const [carts, setCarts] = useState<AbandonedCart[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'recovered' | 'sent' | 'not_contacted'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [customizeCart, setCustomizeCart] = useState<AbandonedCart | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/abandoned-carts');
      if (res.ok) {
        const body = await res.json();
        setCarts(body.carts || []);
      } else {
        toast.error('Failed to load abandoned carts');
      }
    } catch {
      toast.error('Failed to load abandoned carts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const sendNow = async (id: string) => {
    setSendingId(id);
    try {
      const res = await fetch(`/api/admin/abandoned-carts/${id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        toast.success('Recovery email sent');
        await load();
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || 'Failed to send email');
      }
    } catch {
      toast.error('Failed to send email');
    } finally {
      setSendingId(null);
    }
  };

  const activeCount = carts.filter((c) => !c.recovered).length;
  const recoveredCount = carts.filter((c) => c.recovered).length;
  const potentialValue = carts.filter((c) => !c.recovered).reduce((s, c) => s + (c.cart_value || 0), 0);

  const filteredCarts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return carts.filter((c) => {
      const matchesQuery = !q || (c.email ?? '').toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'recovered'
          ? c.recovered
          : statusFilter === 'sent'
          ? !c.recovered && c.recovery_email_sent
          : !c.recovered && !c.recovery_email_sent;
      return matchesQuery && matchesStatus;
    });
  }, [carts, searchQuery, statusFilter]);

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <p className="text-xs text-muted-foreground">Active Abandoned Carts</p>
          <p className="mt-2 text-2xl font-semibold">{activeCount}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <p className="text-xs text-muted-foreground">Recovered</p>
          <p className="mt-2 text-2xl font-semibold">{recoveredCount}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <p className="text-xs text-muted-foreground">Potential Value</p>
          <p className="mt-2 text-2xl font-semibold">{formatINR(potentialValue)}</p>
        </div>
      </div>

      {!loading && carts.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by email…"
              className="pl-9 pr-8"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="recovered">Recovered</SelectItem>
                <SelectItem value="sent">Email Sent</SelectItem>
                <SelectItem value="not_contacted">Not Contacted</SelectItem>
              </SelectContent>
            </Select>
            {(searchQuery || statusFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
              >
                Reset
              </Button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : carts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center text-muted-foreground">
          <ShoppingCart className="h-10 w-10" />
          <p>No abandoned carts yet.</p>
          <p className="text-sm">
            Carts show up here once a shopper enters their email at checkout but doesn't complete the order.
          </p>
        </div>
      ) : filteredCarts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 bg-card px-4 py-12 text-center text-sm text-muted-foreground">
          No abandoned carts match your search or filter.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
          <table className="w-full table-auto">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3"></th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Last Activity</th>
                <th className="px-4 py-3">Recovery</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredCarts.map((c) => {
                const stage = c.recovery_stage || 0;
                const isExpanded = expandedId === c.id;
                return (
                  <Fragment key={c.id}>
                    <tr className="border-t">
                      <td className="px-2 py-3 align-top">
                        {stage > 0 && (
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : c.id)}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label="Toggle email history"
                          >
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-sm">
                        <div>{c.email || '—'}</div>
                        {c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-muted-foreground">
                        {(c.items || []).length} item{(c.items || []).length === 1 ? '' : 's'}
                      </td>
                      <td className="px-4 py-3 align-top text-sm font-medium">{formatINR(c.cart_value || 0)}</td>
                      <td className="px-4 py-3 align-top text-sm">
                        {new Date(c.last_activity_at).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 align-top text-sm">
                        {c.recovered ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                            <CheckCircle2 className="h-3 w-3" /> Recovered
                          </span>
                        ) : stage > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                            <Mail className="h-3 w-3" /> {stage}/3 emails sent
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                            Not contacted
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-sm">
                        <div className="flex flex-wrap gap-2">
                          {!c.recovered && c.email && stage < 3 && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={sendingId === c.id}
                                onClick={() => sendNow(c.id)}
                              >
                                {sendingId === c.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : stage === 0 ? (
                                  'Send recovery email'
                                ) : (
                                  `Send email ${stage + 1}`
                                )}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setCustomizeCart(c)}>
                                Customize &amp; send
                              </Button>
                            </>
                          )}
                          {!c.recovered &&
                            c.phone &&
                            (() => {
                              const link = buildWhatsAppRecoveryLink(c.phone, c.cart_value);
                              if (!link) return null;
                              return (
                                <Button size="sm" variant="outline" asChild>
                                  <a href={link} target="_blank" rel="noopener noreferrer">
                                    <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                                    Send WhatsApp
                                  </a>
                                </Button>
                              );
                            })()}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-t bg-muted/10">
                        <td></td>
                        <td colSpan={6} className="px-4">
                          <CartEmailHistory cartId={c.id} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <SendCustomEmailDialog
        cart={customizeCart}
        open={!!customizeCart}
        onOpenChange={(v) => !v && setCustomizeCart(null)}
        onSent={load}
      />
    </div>
  );
}

export default function AbandonedCartsPanel() {
  return (
    <Tabs defaultValue="carts" className="w-full">
      <TabsList>
        <TabsTrigger value="carts">Carts</TabsTrigger>
        <TabsTrigger value="settings">Sequence Settings</TabsTrigger>
      </TabsList>
      <TabsContent value="carts" className="mt-4">
        <CartsList />
      </TabsContent>
      <TabsContent value="settings" className="mt-4">
        <SequenceSettingsPanel />
      </TabsContent>
    </Tabs>
  );
}
