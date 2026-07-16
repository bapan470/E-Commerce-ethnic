'use client';

import { useEffect, useState } from 'react';
import { formatINR } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { toast } from 'sonner';

type Order = {
  id: string;
  items: any[];
  total_amount: number;
  status: string;
  shipping_address?: any;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  created_at?: string;
};

export default function OrdersPanel() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/orders');
      if (res.ok) {
        const body = await res.json();
        setOrders(body.orders || []);
      } else if (res.status === 401) {
        toast.error('Unauthorized');
      } else {
        toast.error('Failed to load orders');
      }
    } catch (err) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const totalOrders = orders.length;
  const revenue = orders
    .filter((o) => ['paid', 'shipped', 'delivered'].includes(o.status))
    .reduce((s, o) => s + (o.total_amount || 0), 0);
  const pendingCount = orders.filter((o) => o.status === 'pending').length;

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast.success('Status updated');
        await load();
      } else {
        toast.error('Failed to update status');
      }
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Orders</p>
          <p className="mt-2 text-2xl font-semibold">{totalOrders}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <p className="text-xs text-muted-foreground">Revenue</p>
          <p className="mt-2 text-2xl font-semibold">{formatINR(revenue)}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <p className="text-xs text-muted-foreground">Pending</p>
          <p className="mt-2 text-2xl font-semibold">{pendingCount}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
        <table className="w-full table-auto">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <OrderRow key={o.id} order={o} onChangeStatus={updateStatus} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OrderRow({ order, onChangeStatus }: { order: Order; onChangeStatus: (id: string, status: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className="border-t">
        <td className="px-4 py-3 align-top">
          <div className="text-sm font-medium">{order.customer_name || 'Guest'}</div>
          <div className="text-xs text-muted-foreground">{order.customer_email || order.customer_phone}</div>
        </td>
        <td className="px-4 py-3 align-top text-sm">{order.created_at ? new Date(order.created_at).toLocaleString() : ''}</td>
        <td className="px-4 py-3 align-top text-sm font-medium">{formatINR(order.total_amount || 0)}</td>
        <td className="px-4 py-3 align-top text-sm">
          <select
            value={order.status}
            onChange={(e) => onChangeStatus(order.id, e.target.value)}
            className="rounded border px-2 py-1 text-sm"
          >
            {['pending','paid','shipped','delivered','cancelled','failed'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </td>
        <td className="px-4 py-3 align-top text-sm">
          <Button size="sm" onClick={() => setOpen((v) => !v)}>{open ? 'Hide' : 'View'}</Button>
        </td>
      </tr>
      {open && (
        <tr className="bg-muted/20">
          <td colSpan={5} className="px-4 py-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <h4 className="mb-2 text-sm font-semibold">Items</h4>
                <ul className="space-y-2 text-sm">
                  {order.items.map((it: any, idx: number) => (
                    <li key={idx} className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{it.product_name}</div>
                        <div className="text-xs text-muted-foreground">{it.size ? `Size: ${it.size}` : ''}</div>
                      </div>
                      <div className="text-sm">{formatINR(it.price)} x {it.quantity}</div>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold">Shipping</h4>
                <div className="text-sm text-muted-foreground">
                  {order.shipping_address ? (
                    <pre className="whitespace-pre-wrap">{JSON.stringify(order.shipping_address, null, 2)}</pre>
                  ) : (
                    '—'
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
