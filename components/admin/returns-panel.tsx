'use client';

import { useEffect, useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { formatINR } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

type ReturnRow = {
  id: string;
  order_id: string;
  type: 'return' | 'exchange';
  reason: string;
  status: string;
  admin_notes?: string | null;
  refund_amount?: number | null;
  created_at: string;
  order?: {
    customer_name?: string;
    customer_email?: string;
    total_amount?: number;
  } | null;
};

const STATUS_OPTIONS = ['requested', 'approved', 'rejected', 'refunded', 'completed'];

const STATUS_COLORS: Record<string, string> = {
  requested: 'bg-amber-100 text-amber-800',
  approved: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
  refunded: 'bg-emerald-100 text-emerald-800',
  completed: 'bg-emerald-100 text-emerald-800',
};

export default function ReturnsPanel() {
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/returns');
      if (res.ok) {
        const body = await res.json();
        setReturns(body.returns || []);
      } else {
        toast.error('Failed to load return requests');
      }
    } catch {
      toast.error('Failed to load return requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const pendingCount = returns.filter((r) => r.status === 'requested').length;

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Requests</p>
          <p className="mt-2 text-2xl font-semibold">{returns.length}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <p className="text-xs text-muted-foreground">Awaiting Review</p>
          <p className="mt-2 text-2xl font-semibold">{pendingCount}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : returns.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center text-muted-foreground">
          <RotateCcw className="h-10 w-10" />
          <p>No return or exchange requests yet.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {returns.map((r) => (
            <ReturnCard key={r.id} r={r} onUpdated={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReturnCard({ r, onUpdated }: { r: ReturnRow; onUpdated: () => void }) {
  const [status, setStatus] = useState(r.status);
  const [notes, setNotes] = useState(r.admin_notes || '');
  const [refundAmount, setRefundAmount] = useState(r.refund_amount?.toString() || '');
  const [saving, setSaving] = useState(false);

  const dirty =
    status !== r.status ||
    notes !== (r.admin_notes || '') ||
    refundAmount !== (r.refund_amount?.toString() || '');

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/returns/${r.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          admin_notes: notes,
          refund_amount: refundAmount ? Number(refundAmount) : null,
        }),
      });
      if (res.ok) {
        toast.success('Return request updated — customer notified by email');
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
          <p className="font-medium capitalize">
            {r.type} request{' '}
            <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status] || 'bg-muted'}`}>
              {r.status}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Order #{r.order_id.slice(0, 8)} &middot; {r.order?.customer_name || 'Guest'} ({r.order?.customer_email || '—'})
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Requested {new Date(r.created_at).toLocaleString('en-IN')}
          </p>
        </div>
        {r.order?.total_amount !== undefined && (
          <div className="text-sm font-semibold">{formatINR(r.order.total_amount)}</div>
        )}
      </div>

      <p className="mt-3 text-sm">
        <span className="font-medium">Reason: </span>
        {r.reason}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded border px-2 py-1.5 text-sm"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Refund amount (₹)</label>
          <Input
            type="number"
            value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="grid gap-1.5 sm:col-span-1">
          <label className="text-xs font-medium text-muted-foreground">Note to customer</label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional note" />
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <Button size="sm" onClick={save} disabled={!dirty || saving}>
          {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          Save &amp; notify customer
        </Button>
      </div>
    </div>
  );
}
