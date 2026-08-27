'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, ShoppingCart, Mail, MessageCircle, CheckCircle2, Search, X } from 'lucide-react';
import { formatINR } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  recovered: boolean;
};

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

export default function AbandonedCartsPanel() {
  const [carts, setCarts] = useState<AbandonedCart[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'recovered' | 'sent' | 'not_contacted'>('all');

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
      const res = await fetch(`/api/admin/abandoned-carts/${id}/send`, { method: 'POST' });
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
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Last Activity</th>
                <th className="px-4 py-3">Recovery</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredCarts.map((c) => (
                <tr key={c.id} className="border-t">
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
                    ) : c.recovery_email_sent ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                        <Mail className="h-3 w-3" /> Email sent
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        Not contacted
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-sm">
                    <div className="flex flex-wrap gap-2">
                      {!c.recovered && c.email && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={sendingId === c.id}
                          onClick={() => sendNow(c.id)}
                        >
                          {sendingId === c.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            'Send recovery email'
                          )}
                        </Button>
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
