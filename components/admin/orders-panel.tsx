'use client';

import { useEffect, useState } from 'react';
import { Loader2, Truck } from 'lucide-react';
import { formatINR } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { toast } from 'sonner';
import OrderTracking from '@/components/order/order-tracking';
import CreateShipmentModal, {
  type CreateShipmentPayload,
} from '@/components/admin/create-shipment-modal';

type Order = {
  id: string;
  items: any[];
  total_amount: number;
  status: string;
  payment_method?: string;
  tracking_number?: string | null;
  courier_name?: string | null;
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

  const [creatingShipmentFor, setCreatingShipmentFor] = useState<string | null>(null);
  const [shipmentModalOrderId, setShipmentModalOrderId] = useState<string | null>(null);
  const [pendingStatusAfterShip, setPendingStatusAfterShip] = useState<string | null>(null);

  const createShipment = async (id: string, packageDetails?: CreateShipmentPayload): Promise<boolean> => {
    setCreatingShipmentFor(id);
    try {
      const res = await fetch('/api/admin/delhivery/create-shipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: id, ...(packageDetails || {}) }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(`Shipment created — waybill ${body.waybill}`);
        await load();
        return true;
      }
      toast.error(body.error || 'Failed to create Delhivery shipment');
      return false;
    } catch (err) {
      toast.error('Failed to create Delhivery shipment');
      return false;
    } finally {
      setCreatingShipmentFor(null);
    }
  };

  // Opens the box/weight/mode popup instead of hitting the Delhivery API directly.
  const openShipmentModal = (id: string) => setShipmentModalOrderId(id);

  const confirmShipmentFromModal = async (payload: CreateShipmentPayload) => {
    if (!shipmentModalOrderId) return;
    const ok = await createShipment(shipmentModalOrderId, payload);
    if (ok) {
      setShipmentModalOrderId(null);
      setPendingStatusAfterShip(null);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    // Moving an order to "shipped" first opens the box/weight/mode popup so the
    // admin can review before Delhivery actually manifests (and charges) it.
    const order = orders.find((o) => o.id === id);
    if (status === 'shipped' && order && !order.tracking_number) {
      setPendingStatusAfterShip(status);
      openShipmentModal(id);
      return;
    }

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
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ship</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <OrderRow
                key={o.id}
                order={o}
                onChangeStatus={updateStatus}
                onCreateShipment={openShipmentModal}
                creatingShipment={creatingShipmentFor === o.id}
              />
            ))}
          </tbody>
        </table>
      </div>

      <CreateShipmentModal
        open={!!shipmentModalOrderId}
        onOpenChange={(open) => {
          if (!open) {
            setShipmentModalOrderId(null);
            setPendingStatusAfterShip(null);
          }
        }}
        destinationPincode={orders.find((o) => o.id === shipmentModalOrderId)?.shipping_address?.pincode}
        paymentMethod={orders.find((o) => o.id === shipmentModalOrderId)?.payment_method}
        confirming={creatingShipmentFor === shipmentModalOrderId}
        onConfirm={confirmShipmentFromModal}
      />
    </div>
  );
}

function OrderRow({
  order,
  onChangeStatus,
  onCreateShipment,
  creatingShipment,
}: {
  order: Order;
  onChangeStatus: (id: string, status: string) => void;
  onCreateShipment: (id: string) => void;
  creatingShipment: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className="border-t">
        <td className="px-4 py-3 align-top">
          <div className="text-sm font-medium">{order.customer_name || 'Guest'}</div>
          <div className="text-xs text-muted-foreground">{order.customer_email || order.customer_phone}</div>
        </td>
        <td className="px-4 py-3 align-top">
          <div className="flex items-center gap-2">
            {order.items[0]?.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={order.items[0].image_url}
                alt={order.items[0].product_name}
                className="h-9 w-9 flex-shrink-0 rounded-md border border-border/60 object-cover"
              />
            ) : (
              <div className="h-9 w-9 flex-shrink-0 rounded-md border border-border/60 bg-muted" />
            )}
            <div className="text-xs">
              <div className="max-w-[9rem] truncate font-medium">{order.items[0]?.product_name || '—'}</div>
              {order.items.length > 1 && (
                <div className="text-muted-foreground">+{order.items.length - 1} more</div>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-3 align-top text-sm">{order.created_at ? new Date(order.created_at).toLocaleString() : ''}</td>
        <td className="px-4 py-3 align-top text-sm font-medium">{formatINR(order.total_amount || 0)}</td>
        <td className="px-4 py-3 align-top text-sm">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              order.payment_method === 'cod'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            {order.payment_method === 'cod' ? 'COD' : 'Online'}
          </span>
        </td>
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
          {order.tracking_number ? (
            <div className="flex items-center gap-1.5 text-xs">
              <Truck className="h-3.5 w-3.5 text-secondary" />
              <span className="font-medium">{order.tracking_number}</span>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={creatingShipment}
              onClick={() => onCreateShipment(order.id)}
              className="gap-1.5"
            >
              {creatingShipment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />}
              Create Shipment
            </Button>
          )}
        </td>
        <td className="px-4 py-3 align-top text-sm">
          <Button size="sm" onClick={() => setOpen((v) => !v)}>{open ? 'Hide' : 'View'}</Button>
        </td>
      </tr>
      {open && (
        <tr className="bg-muted/20">
          <td colSpan={8} className="px-4 py-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <h4 className="mb-2 text-sm font-semibold">Items</h4>
                <ul className="space-y-2 text-sm">
                  {order.items.map((it: any, idx: number) => (
                    <li key={idx} className="flex items-center gap-3">
                      {it.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={it.image_url}
                          alt={it.product_name}
                          className="h-12 w-12 flex-shrink-0 rounded-md border border-border/60 object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 flex-shrink-0 rounded-md border border-border/60 bg-muted" />
                      )}
                      <div className="flex-1">
                        <div className="font-medium">{it.product_name}</div>
                        <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                          {it.color && (
                            <span className="rounded-full bg-muted px-2 py-0.5">Color: {it.color}</span>
                          )}
                          {it.size && (
                            <span className="rounded-full bg-muted px-2 py-0.5">Size: {it.size}</span>
                          )}
                        </div>
                      </div>
                      <div className="whitespace-nowrap text-sm">{formatINR(it.price)} x {it.quantity}</div>
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
            <div className="mt-4">
              <h4 className="mb-2 text-sm font-semibold">Live Tracking</h4>
              <OrderTracking
                orderId={order.id}
                initialTrackingNumber={order.tracking_number}
                initialCourierName={order.courier_name}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
