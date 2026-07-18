'use client';

import { useEffect, useState } from 'react';
import { Bell, Loader2, Mail, Trash2, CheckCircle2 } from 'lucide-react';
import {
  fetchStockNotifications,
  deleteStockNotification,
  StockNotificationRow,
} from '@/lib/stock-notify-api';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function StockNotificationsPanel() {
  const [rows, setRows] = useState<StockNotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingProductId, setSendingProductId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchStockNotifications();
      setRows(data);
    } catch {
      toast.error('Failed to load restock signups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const notifyNow = async (productId: string) => {
    setSendingProductId(productId);
    try {
      const res = await fetch('/api/admin/notify-restock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(
          body.sent > 0 ? `Notified ${body.sent} customer${body.sent === 1 ? '' : 's'}` : 'No pending signups for this product'
        );
        await load();
      } else {
        toast.error(body.error || 'Failed to send notifications');
      }
    } catch {
      toast.error('Failed to send notifications');
    } finally {
      setSendingProductId(null);
    }
  };

  const remove = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteStockNotification(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch {
      toast.error('Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  // Group by product so admin can trigger one "Notify now" per product,
  // rather than per individual signup row.
  const byProduct = new Map<string, { name: string; slug: string; inStock: boolean; rows: StockNotificationRow[] }>();
  for (const r of rows) {
    const key = r.product_id;
    const existing = byProduct.get(key);
    const name = r.products?.name || 'Unknown product';
    const slug = r.products?.slug || '';
    const inStock = !!r.products?.in_stock;
    if (existing) {
      existing.rows.push(r);
    } else {
      byProduct.set(key, { name, slug, inStock, rows: [r] });
    }
  }

  const pendingTotal = rows.filter((r) => !r.notified).length;

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <p className="text-xs text-muted-foreground">Pending Signups</p>
          <p className="mt-2 text-2xl font-semibold">{pendingTotal}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <p className="text-xs text-muted-foreground">Products Watched</p>
          <p className="mt-2 text-2xl font-semibold">{byProduct.size}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Signups</p>
          <p className="mt-2 text-2xl font-semibold">{rows.length}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : byProduct.size === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center text-muted-foreground">
          <Bell className="h-10 w-10" />
          <p>No restock signups yet.</p>
          <p className="text-sm">
            When a customer clicks &quot;Notify me&quot; on an out-of-stock product, it shows up here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {Array.from(byProduct.entries()).map(([productId, group]) => {
            const pending = group.rows.filter((r) => !r.notified);
            return (
              <div key={productId} className="overflow-hidden rounded-lg border border-border/60 bg-card">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-muted/30 px-4 py-3">
                  <div>
                    <p className="font-medium">{group.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {group.inStock ? (
                        <span className="text-emerald-700">In stock now</span>
                      ) : (
                        'Currently out of stock'
                      )}
                      {' · '}
                      {pending.length} waiting
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending.length === 0 || sendingProductId === productId}
                    onClick={() => notifyNow(productId)}
                    className="gap-2"
                  >
                    {sendingProductId === productId ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Mail className="h-3.5 w-3.5" />
                    )}
                    Notify now
                  </Button>
                </div>
                <table className="w-full table-auto">
                  <tbody>
                    {group.rows.map((r) => (
                      <tr key={r.id} className="border-t border-border/40">
                        <td className="px-4 py-2.5 text-sm">{r.email}</td>
                        <td className="px-4 py-2.5 text-sm text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString('en-IN')}
                        </td>
                        <td className="px-4 py-2.5 text-sm">
                          {r.notified ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                              <CheckCircle2 className="h-3 w-3" /> Notified
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                              Waiting
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={deletingId === r.id}
                            onClick={() => remove(r.id)}
                          >
                            {deletingId === r.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            )}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
