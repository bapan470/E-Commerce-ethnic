'use client';

import { useEffect, useState } from 'react';
import { Loader2, LifeBuoy, Bot } from 'lucide-react';
import { formatINR } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

type TicketRow = {
  id: string;
  order_id: string | null;
  customer_name?: string | null;
  customer_email: string;
  subject: string;
  message: string;
  source: 'chat' | 'admin' | 'email' | 'other';
  status: string;
  admin_notes?: string | null;
  created_at: string;
  order?: {
    customer_name?: string;
    customer_email?: string;
    status?: string;
    total_amount?: number;
  } | null;
};

const STATUS_OPTIONS = ['open', 'in_progress', 'resolved', 'closed'];

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-amber-100 text-amber-800',
  in_progress: 'bg-blue-100 text-blue-800',
  resolved: 'bg-emerald-100 text-emerald-800',
  closed: 'bg-muted text-muted-foreground',
};

export default function SupportTicketsPanel() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/support-tickets');
      if (res.ok) {
        const body = await res.json();
        setTickets(body.tickets || []);
      } else {
        toast.error('Failed to load support tickets');
      }
    } catch {
      toast.error('Failed to load support tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCount = tickets.filter((t) => t.status === 'open').length;
  const chatCount = tickets.filter((t) => t.source === 'chat').length;

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Tickets</p>
          <p className="mt-2 text-2xl font-semibold">{tickets.length}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <p className="text-xs text-muted-foreground">Open</p>
          <p className="mt-2 text-2xl font-semibold">{openCount}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <p className="text-xs text-muted-foreground">Raised via AI Chat</p>
          <p className="mt-2 flex items-center gap-1.5 text-2xl font-semibold">
            <Bot className="h-4 w-4 text-muted-foreground" /> {chatCount}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center text-muted-foreground">
          <LifeBuoy className="h-10 w-10" />
          <p>No support tickets yet. Tickets raised from the AI chat widget will show up here.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {tickets.map((t) => (
            <TicketCard key={t.id} t={t} onUpdated={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function TicketCard({ t, onUpdated }: { t: TicketRow; onUpdated: () => void }) {
  const [status, setStatus] = useState(t.status);
  const [notes, setNotes] = useState(t.admin_notes || '');
  const [saving, setSaving] = useState(false);

  const dirty = status !== t.status || notes !== (t.admin_notes || '');

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/support-tickets/${t.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_notes: notes }),
      });
      if (res.ok) {
        toast.success('Ticket updated');
        onUpdated();
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || 'Failed to update');
      }
    } catch {
      toast.error('Failed to update');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-border/60 bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            {t.subject}{' '}
            <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[t.status] || 'bg-muted'}`}>
              {t.status.replace('_', ' ')}
            </span>
            {t.source === 'chat' && (
              <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                <Bot className="h-3 w-3" /> AI chat
              </span>
            )}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t.customer_name || 'Guest'} ({t.customer_email})
            {t.order_id && <> &middot; Order #{t.order_id.slice(0, 8).toUpperCase()}</>}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Raised {new Date(t.created_at).toLocaleString('en-IN')}
          </p>
        </div>
        {t.order?.total_amount !== undefined && (
          <div className="text-sm font-semibold">{formatINR(t.order.total_amount!)}</div>
        )}
      </div>

      <p className="mt-3 text-sm">
        <span className="font-medium">Message: </span>
        {t.message}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded border px-2 py-1.5 text-sm"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Internal note</label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional note" />
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <Button size="sm" onClick={save} disabled={!dirty || saving}>
          {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  );
}
