'use client';

import { useEffect, useState } from 'react';
import { Loader2, Circle } from 'lucide-react';

interface HistoryEntry {
  id: string;
  from_status: string | null;
  to_status: string;
  changed_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Order placed',
  paid: 'Payment received',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  failed: 'Payment failed',
};

export default function OrderStatusHistory({ orderId }: { orderId: string }) {
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/orders/${orderId}/status-history`);
        if (!res.ok) throw new Error('Failed');
        const body = await res.json();
        if (!cancelled) setHistory(body.history || []);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (error) {
    return <p className="text-xs text-muted-foreground">Couldn't load status history.</p>;
  }

  if (!history) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading history...
      </div>
    );
  }

  if (history.length === 0) {
    return <p className="text-xs text-muted-foreground">No status history yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {history.map((entry, idx) => (
        <li key={entry.id} className="flex items-start gap-2 text-sm">
          <Circle
            className={`mt-0.5 h-3 w-3 flex-shrink-0 ${
              idx === history.length - 1 ? 'fill-secondary text-secondary' : 'fill-muted-foreground/40 text-muted-foreground/40'
            }`}
          />
          <div>
            <div className="font-medium">{STATUS_LABELS[entry.to_status] || entry.to_status}</div>
            <div className="text-xs text-muted-foreground">
              {new Date(entry.changed_at).toLocaleString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
