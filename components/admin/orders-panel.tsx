'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Truck, Search, X, Copy, Check, Trash2, ExternalLink, Wallet } from 'lucide-react';
import { formatINR } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select as SelectRoot,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
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
import OrderTracking from '@/components/order/order-tracking';
import OrderStatusHistory from '@/components/admin/order-status-history';
import DeliveryNotificationTester from '@/components/admin/delivery-notification-tester';
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
  expected_delivery_date?: string | null;
  shipping_address?: any;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  created_at?: string;
  is_reseller_order?: boolean;
  reseller_base_cost?: number | null;
  reseller_profit?: number | null;
  reseller_brand_name?: string | null;
  // Admin-only hidden sourcing info, attached server-side in lib/orders-api.ts
  // (fetchOrders -> attachItemSources). Keyed by product_id.
  _item_sources?: Record<string, { source_name: string | null; whatsapp_name: string | null; whatsapp_number: string | null; buy_price: number | null }>;
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

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return orders.filter((o) => {
      const matchesQuery =
        !q ||
        o.id.toLowerCase().includes(q) ||
        (o.customer_name ?? '').toLowerCase().includes(q) ||
        (o.customer_email ?? '').toLowerCase().includes(q) ||
        (o.customer_phone ?? '').toLowerCase().includes(q) ||
        o.items.some((it: any) => (it.product_name ?? '').toLowerCase().includes(q));

      const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
      const matchesPayment =
        paymentFilter === 'all' ||
        (paymentFilter === 'cod' ? o.payment_method === 'cod' : o.payment_method !== 'cod');

      return matchesQuery && matchesStatus && matchesPayment;
    });
  }, [orders, searchQuery, statusFilter, paymentFilter]);

  const totalOrders = orders.length;
  // Sum of every order's total, regardless of status -- this is the figure
  // the admin actually wants when they ask "total price" for the order list.
  const totalOrderValue = orders.reduce((s, o) => s + (o.total_amount || 0), 0);
  const revenue = orders
    .filter((o) => ['paid', 'shipped', 'delivered'].includes(o.status))
    .reduce((s, o) => s + (o.total_amount || 0), 0);
  const pendingCount = orders.filter((o) => o.status === 'pending').length;
  const filtersActive = !!searchQuery || statusFilter !== 'all' || paymentFilter !== 'all';
  const filteredTotal = filteredOrders.reduce((s, o) => s + (o.total_amount || 0), 0);

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

  // Converts a COD order (item not kept ready-made -> needs prep time) to
  // "pay online first": flips payment_method, emails the customer an
  // apology + a link to pay. See app/api/admin/orders/[id]/request-online-payment.
  const [requestingOnlinePaymentFor, setRequestingOnlinePaymentFor] = useState<string | null>(null);
  const requestOnlinePayment = async (id: string) => {
    setRequestingOnlinePaymentFor(id);
    try {
      const res = await fetch(`/api/admin/orders/${id}/request-online-payment`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.success) {
        if (body.emailed) {
          toast.success('Order converted to online payment — email sent to the customer');
        } else {
          toast.warning('Order converted, but the email failed to send — try "Send test" from Test Notifications');
        }
        await load();
      } else {
        toast.error(body.error || 'Failed to request online payment');
      }
    } catch {
      toast.error('Failed to request online payment');
    } finally {
      setRequestingOnlinePaymentFor(null);
    }
  };

  // ---- Select rows + bulk delete ----
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allVisibleSelected =
    filteredOrders.length > 0 && filteredOrders.every((o) => selectedIds.has(o.id));
  const someVisibleSelected = filteredOrders.some((o) => selectedIds.has(o.id));

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        filteredOrders.forEach((o) => next.delete(o.id));
      } else {
        filteredOrders.forEach((o) => next.add(o.id));
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const deleteSelectedOrders = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(`${ids.length} order${ids.length === 1 ? '' : 's'} deleted`);
        clearSelection();
        setConfirmBulkDelete(false);
        await load();
      } else {
        toast.error(body.error || 'Failed to delete orders');
      }
    } catch (err) {
      toast.error('Failed to delete orders');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Orders</p>
          <p className="mt-2 text-2xl font-semibold">
            {filtersActive ? `${filteredOrders.length} / ${totalOrders}` : totalOrders}
          </p>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Order Value</p>
          <p className="mt-2 text-2xl font-semibold">
            {formatINR(filtersActive ? filteredTotal : totalOrderValue)}
          </p>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <p className="text-xs text-muted-foreground">Revenue (paid/shipped/delivered)</p>
          <p className="mt-2 text-2xl font-semibold">{formatINR(revenue)}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <p className="text-xs text-muted-foreground">Pending</p>
          <p className="mt-2 text-2xl font-semibold">{pendingCount}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search order ID, customer, product…"
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

        <div className="flex flex-wrap items-center gap-2">
          <SelectRoot value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {['pending', 'paid', 'shipped', 'delivered', 'cancelled', 'failed'].map((s) => (
                <SelectItem key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </SelectRoot>

          <SelectRoot value={paymentFilter} onValueChange={setPaymentFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="All Payments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Payments</SelectItem>
              <SelectItem value="cod">COD</SelectItem>
              <SelectItem value="online">Online</SelectItem>
            </SelectContent>
          </SelectRoot>

          {filtersActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setPaymentFilter('all');
              }}
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2.5">
          <p className="text-sm font-medium">
            {selectedIds.size} order{selectedIds.size === 1 ? '' : 's'} selected
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Clear
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={() => setConfirmBulkDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Selected
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
        <table className="w-full table-auto">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-10 px-4 py-3">
                <Checkbox
                  checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
                  onCheckedChange={toggleSelectAllVisible}
                  aria-label="Select all orders"
                />
              </th>
              <th className="px-4 py-3">Order ID</th>
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
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No orders match your search or filters.
                </td>
              </tr>
            ) : (
              filteredOrders.map((o) => (
                <OrderRow
                  key={o.id}
                  order={o}
                  selected={selectedIds.has(o.id)}
                  onToggleSelect={toggleSelectOne}
                  onChangeStatus={updateStatus}
                  onCreateShipment={openShipmentModal}
                  creatingShipment={creatingShipmentFor === o.id}
                  onRequestOnlinePayment={requestOnlinePayment}
                  requestingOnlinePayment={requestingOnlinePaymentFor === o.id}
                />
              ))
            )}
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

      {/* Bulk delete confirm */}
      <Dialog open={confirmBulkDelete} onOpenChange={(open) => !open && setConfirmBulkDelete(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-primary">
              Delete {selectedIds.size} order{selectedIds.size === 1 ? '' : 's'}?
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. The selected order{selectedIds.size === 1 ? '' : 's'} will be
              permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={deleting}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={deleteSelectedOrders}
              className="gap-1.5"
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrderRow({
  order,
  selected,
  onToggleSelect,
  onChangeStatus,
  onCreateShipment,
  creatingShipment,
  onRequestOnlinePayment,
  requestingOnlinePayment,
}: {
  order: Order;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onChangeStatus: (id: string, status: string) => void;
  onCreateShipment: (id: string) => void;
  creatingShipment: boolean;
  onRequestOnlinePayment: (id: string) => void;
  requestingOnlinePayment: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const shortId = order.id.slice(0, 8).toUpperCase();

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(order.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard not available -- ignore
    }
  };

  return (
    <>
      <tr className={`border-t ${selected ? 'bg-destructive/5' : ''}`}>
        <td className="px-4 py-3 align-top">
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelect(order.id)}
            aria-label={`Select order ${order.id}`}
          />
        </td>
        <td className="px-4 py-3 align-top">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs font-semibold" title={order.id}>
              #{shortId}
            </span>
            <button
              type="button"
              onClick={copyId}
              aria-label="Copy order ID"
              className="text-muted-foreground hover:text-primary"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
        </td>
        <td className="px-4 py-3 align-top">
          <div className="text-sm font-medium">{order.customer_name || 'Guest'}</div>
          {order.customer_email && (
            <div className="text-xs text-muted-foreground">{order.customer_email}</div>
          )}
          {order.customer_phone && (
            <div className="text-xs text-muted-foreground">{order.customer_phone}</div>
          )}
          {!order.customer_email && !order.customer_phone && (
            <div className="text-xs text-muted-foreground">—</div>
          )}
          {order.is_reseller_order && (
            <div className="mt-1 flex flex-col gap-0.5">
              <span className="w-fit rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                Resale{order.reseller_brand_name ? ` · ${order.reseller_brand_name}` : ''}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {typeof order.reseller_base_cost === 'number'
                  ? `${formatINR(order.reseller_base_cost)} → ${formatINR(order.total_amount)}`
                  : null}
                {typeof order.reseller_profit === 'number' ? (
                  <span className="font-semibold text-green-600"> · +{formatINR(order.reseller_profit)} profit</span>
                ) : null}
              </span>
            </div>
          )}
        </td>
        <td className="px-4 py-3 align-top">
          <div className="flex items-center gap-2">
            {order.items[0]?.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={order.items[0].image_url}
                alt={order.items[0].product_name}
                className="h-9 w-9 flex-shrink-0 rounded-md border border-border/60 object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : null}
            {order.items[0]?.image_url ? (
              <div className="hidden h-9 w-9 flex-shrink-0 rounded-md border border-border/60 bg-muted" />
            ) : (
              <div className="h-9 w-9 flex-shrink-0 rounded-md border border-border/60 bg-muted" />
            )}
            <div className="text-xs">
              {order.items[0]?.slug ? (
                <Link
                  href={`/product/${order.items[0].slug}`}
                  target="_blank"
                  className="flex max-w-[9rem] items-center gap-1 truncate font-medium hover:underline"
                  title="Open the exact colour/variation ordered"
                >
                  <span className="truncate">{order.items[0]?.product_name || '—'}</span>
                  <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                </Link>
              ) : (
                <div className="max-w-[9rem] truncate font-medium">{order.items[0]?.product_name || '—'}</div>
              )}
              {order.items.length > 1 && (
                <div className="text-muted-foreground">+{order.items.length - 1} more</div>
              )}
              {order.items[0]?.product_id && order._item_sources?.[order.items[0].product_id]?.source_name && (
                <div
                  className="mt-0.5 w-fit rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
                  title="Admin-only sourcing info — never shown to the customer"
                >
                  Source: {order._item_sources[order.items[0].product_id].source_name}
                  {order._item_sources[order.items[0].product_id].whatsapp_number
                    ? ` · ${order._item_sources[order.items[0].product_id].whatsapp_number}`
                    : ''}
                </div>
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
          {order.payment_method === 'cod' && order.status === 'pending' && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={requestingOnlinePayment}
              onClick={() => onRequestOnlinePayment(order.id)}
              className="mt-1.5 block h-auto w-fit gap-1 px-2 py-1 text-[11px] leading-tight"
              title="Item needs prep time — ask the customer to pay online first instead of COD"
            >
              {requestingOnlinePayment ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Wallet className="h-3 w-3" />
              )}
              Request Online Payment
            </Button>
          )}
        </td>
        <td className="px-4 py-3 align-top text-sm">
          {/* An online order stuck at "pending" almost always means the
              Razorpay popup was closed/abandoned before payment finished —
              that's a different situation from a COD order sitting
              "pending" (which is completely normal, since COD is only
              collected at delivery). Flag it clearly instead of leaving
              both looking identical in a plain dropdown. */}
          {order.status === 'pending' && order.payment_method !== 'cod' && (
            <div className="mb-1 w-fit rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
              Payment Pending
            </div>
          )}
          {order.status === 'paid' && (
            <div className="mb-1 w-fit rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              Paid
            </div>
          )}
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
          <td colSpan={10} className="px-4 py-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      {it.image_url ? (
                        <div className="hidden h-12 w-12 flex-shrink-0 rounded-md border border-border/60 bg-muted" />
                      ) : (
                        <div className="h-12 w-12 flex-shrink-0 rounded-md border border-border/60 bg-muted" />
                      )}
                      <div className="flex-1">
                        {it.slug ? (
                          <Link
                            href={`/product/${it.slug}`}
                            target="_blank"
                            className="inline-flex items-center gap-1 font-medium hover:underline"
                            title="Open the exact colour/variation ordered"
                          >
                            {it.product_name}
                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                          </Link>
                        ) : (
                          <div className="font-medium">{it.product_name}</div>
                        )}
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
              <div>
                <h4 className="mb-2 text-sm font-semibold">Status History</h4>
                <OrderStatusHistory orderId={order.id} />
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
            <div className="mt-4">
              <DeliveryNotificationTester
                orderId={order.id}
                customerEmail={order.customer_email}
                initialExpectedDate={order.expected_delivery_date}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
