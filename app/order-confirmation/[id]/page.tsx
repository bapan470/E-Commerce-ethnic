import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { CheckCircle2, Download, Truck, ShieldCheck, LogIn } from 'lucide-react';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { formatINR } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import OrderTracking from '@/components/order/order-tracking';
import PurchaseTracker from '@/components/analytics/purchase-tracker';
import TrustpilotInvitation from '@/components/analytics/trustpilot-invitation';
import CancelOrHelp from '@/components/order/cancel-or-help';
import { fetchFulfillmentSettings } from '@/lib/marketing-api';

// This page reads live order status (payment status, cancellation, ship
// status) straight from the DB, and the Cancel Order button on this same
// page needs the very next visit to reflect the new status. Next.js's
// App Router caches server-component fetches by default (force-cache),
// which was serving a stale "pending" snapshot even after the order had
// actually been cancelled in the DB. Forcing this route to be fully
// dynamic (no caching, always re-fetch) fixes that.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Badge styling per order.status. Keeps this page in sync with whatever
// the admin last set from Admin -> Orders (paid/shipped/delivered/
// cancelled/failed), instead of always reading "placed successfully".
const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700' },
  paid: { label: 'Payment Confirmed', className: 'bg-emerald-100 text-emerald-700' },
  shipped: { label: 'Shipped', className: 'bg-sky-100 text-sky-700' },
  delivered: { label: 'Delivered', className: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700' },
  failed: { label: 'Payment Failed', className: 'bg-red-100 text-red-700' },
};

export default async function OrderConfirmationPage({ params }: { params: { id: string } }) {
  const supabase = getSupabaseAdmin();
  const { data: order } = await supabase.from('orders').select('*').eq('id', params.id).single();

  if (!order) notFound();

  const { cancellation_window_hours: CANCELLATION_WINDOW_HOURS } = await fetchFulfillmentSettings();
  const hoursSinceOrder = (Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60);

  const items = Array.isArray(order.items) ? order.items : [];
  const addr = order.shipping_address as {
    address?: string;
    address2?: string;
    city?: string;
    state?: string;
    pincode?: string;
  } | null;

  return (
    <div className="container-boutique max-w-3xl py-10">
      <PurchaseTracker
        orderId={order.id}
        value={order.total_amount}
        shipping={order.shipping_charge ?? 0}
        tax={order.gst_amount ?? 0}
        couponCode={order.coupon_code}
        items={items.map((item: any) => ({
          product_id: item.product_id ?? null,
          product_name: item.product_name,
          price: item.price,
          quantity: item.quantity,
        }))}
        customerEmail={order.customer_email}
        customerPhone={order.customer_phone}
        customerName={order.customer_name}
        shippingCity={addr?.city ?? null}
        shippingState={addr?.state ?? null}
        shippingPostalCode={addr?.pincode ?? null}
      />
      <TrustpilotInvitation
        orderId={order.id}
        recipientEmail={order.customer_email}
        recipientName={order.customer_name}
      />
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="rounded-full bg-secondary/20 p-4">
          <CheckCircle2 className="h-10 w-10 text-secondary" />
        </div>
        <h1 className="font-serif text-3xl font-bold text-primary">Thank you for your order!</h1>
        {STATUS_BADGE[order.status] && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${STATUS_BADGE[order.status].className}`}
          >
            {STATUS_BADGE[order.status].label}
          </span>
        )}
        <p className="max-w-md text-sm text-muted-foreground">
          Order #{order.id.slice(0, 8).toUpperCase()} has been placed successfully. A confirmation
          email is on its way to {order.customer_email}. Your handwoven pieces will be dispatched
          soon.
          {order.status === 'cancelled' && (
            <>
              {' '}
              This order has since been <strong>cancelled</strong>.
            </>
          )}
          {order.payment_method === 'cod' && order.status !== 'cancelled' && (
            <>
              {' '}
              Please keep <strong>{formatINR(order.total_amount)}</strong> ready in cash for our
              delivery partner.
            </>
          )}
        </p>
        <CancelOrHelp
          orderId={order.id}
          orderShortId={order.id.slice(0, 8).toUpperCase()}
          status={order.status}
          trackingNumber={order.tracking_number}
          hoursSinceOrder={hoursSinceOrder}
          cancellationWindowHours={CANCELLATION_WINDOW_HOURS}
        />
      </div>

      <div className="mt-8 rounded-lg border border-border/60 bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-lg font-semibold text-primary">Order Summary</h2>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <a href={`/api/invoice/${order.id}`} download>
              <Download className="h-3.5 w-3.5" /> Download GST Invoice
            </a>
          </Button>
        </div>

        <Separator className="my-4" />

        <div className="divide-y divide-border/60">
          {items.map((item: any, i: number) => (
            <div key={i} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div className="flex items-center gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted">
                  <Image
                    src={item.image_url || 'https://placehold.co/80x80?text=No+Image'}
                    alt={item.product_name || 'Product'}
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                </div>
                <div>
                  <p className="font-medium">{item.product_name}</p>
                  <p className="text-muted-foreground">
                    Size: {item.size} &middot; Qty: {item.quantity}
                  </p>
                </div>
              </div>
              <p className="font-medium">{formatINR(item.price * item.quantity)}</p>
            </div>
          ))}
        </div>

        <Separator className="my-4" />

        <div className="flex flex-col gap-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatINR(order.subtotal ?? order.total_amount)}</span>
          </div>
          {order.coupon_discount > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Coupon ({order.coupon_code})</span>
              <span>-{formatINR(order.coupon_discount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Shipping</span>
            <span>{order.shipping_charge ? formatINR(order.shipping_charge) : 'FREE'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">GST (included)</span>
            <span>{formatINR(order.gst_amount ?? 0)}</span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between font-semibold text-foreground">
            <span>{order.payment_method === 'cod' ? 'Total (Pay on Delivery)' : 'Total Paid'}</span>
            <span className="font-serif text-lg text-primary">{formatINR(order.total_amount)}</span>
          </div>
        </div>

        <Separator className="my-4" />

        <div>
          <h3 className="text-sm font-semibold">Shipping Address</h3>
          {addr && (
            <p className="mt-1.5 text-sm text-muted-foreground">
              {order.customer_name}
              <br />
              {[addr.address, addr.address2].filter(Boolean).join(', ')}
              <br />
              {[addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')}
              <br />
              Phone: {order.customer_phone}
            </p>
          )}
        </div>
      </div>

      <div className="mt-5">
        <h2 className="mb-2 font-serif text-lg font-semibold text-primary">Shipment Tracking</h2>
        <OrderTracking
          orderId={order.id}
          initialTrackingNumber={order.tracking_number}
          initialCourierName={order.courier_name}
        />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 rounded-lg border border-border/60 bg-card p-4 text-center text-sm sm:grid-cols-3">
        <div className="flex flex-col items-center gap-1">
          <Truck className="h-5 w-5 text-secondary" />
          <span className="text-[11px] font-medium">Dispatch in 2-3 days</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <ShieldCheck className="h-5 w-5 text-secondary" />
          <span className="text-[11px] font-medium">100% Authentic</span>
        </div>
        <div className="col-span-2 flex flex-col items-center gap-1 sm:col-span-1">
          <Download className="h-5 w-5 text-secondary" />
          <span className="text-[11px] font-medium">GST Invoice available above</span>
        </div>
      </div>

      {order.customer_email && (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-lg border border-dashed border-secondary/50 bg-secondary/5 p-4 text-center">
          <LogIn className="h-5 w-5 text-secondary" />
          <p className="text-sm">
            Want more order detail, or to manage returns, addresses and your account from here on?
          </p>
          <Button asChild size="sm" className="bg-primary">
            <Link
              href={`/login?next=${encodeURIComponent(`/account/orders/${order.id}`)}&email=${encodeURIComponent(order.customer_email)}`}
            >
              Log in with {order.customer_email}
            </Link>
          </Button>
          <p className="text-[11px] text-muted-foreground">
            We'll email a one-time code to this address — no password needed.
          </p>
        </div>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild className="bg-primary">
          <Link href="/shop">Continue Shopping</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/track/${order.id}`}>Track this order</Link>
        </Button>
      </div>
    </div>
  );
}
