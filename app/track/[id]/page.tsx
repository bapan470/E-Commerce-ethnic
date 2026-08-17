import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle2, Circle, Package, Truck, Home, XCircle, LogIn } from 'lucide-react';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { formatINR } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import OrderTracking from '@/components/order/order-tracking';

// Guest-friendly tracking page. Uses the exact same trust model already used
// by /order-confirmation/[id] and the self-cancel API: the order UUID itself
// is the access token, so no login/signup is required to view it -- this is
// what "Track this order" links to instead of the account-only
// /account/orders/[id] page, and what every order-lifecycle email links to.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STEPS = [
  { key: 'placed', label: 'Order Placed', icon: CheckCircle2 },
  { key: 'confirmed', label: 'Confirmed', icon: Package },
  { key: 'shipped', label: 'Shipped', icon: Truck },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: Home },
] as const;

function currentStepIndex(order: { status: string; out_for_delivery?: boolean; tracking_number?: string | null }) {
  if (order.status === 'delivered') return 4;
  if (order.out_for_delivery) return 3;
  if (order.status === 'shipped' || order.tracking_number) return 2;
  if (order.status === 'paid') return 1;
  return 0;
}

export default async function TrackOrderPage({ params }: { params: { id: string } }) {
  const supabase = getSupabaseAdmin();
  const { data: order } = await supabase.from('orders').select('*').eq('id', params.id).single();

  if (!order) notFound();

  const items = Array.isArray(order.items) ? order.items : [];
  const isCancelled = order.status === 'cancelled' || order.status === 'failed';
  const stepIdx = currentStepIndex(order);

  const expected = order.expected_delivery_date
    ? new Date(order.expected_delivery_date).toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : null;

  return (
    <div className="container-boutique max-w-2xl py-10">
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Order #{order.id.slice(0, 8).toUpperCase()}
        </p>
        <h1 className="mt-1 font-serif text-2xl font-bold text-primary sm:text-3xl">
          {isCancelled ? 'Order Cancelled' : 'Track Your Order'}
        </h1>
        {expected && !isCancelled && order.status !== 'delivered' && (
          <p className="mt-2 text-sm text-secondary-foreground">
            Arriving <strong>{expected}</strong>
          </p>
        )}
      </div>

      {/* Status stepper */}
      {!isCancelled ? (
        <div className="mt-8 flex items-start justify-between">
          {STEPS.map((step, i) => {
            const done = i <= stepIdx;
            const Icon = done ? step.icon : Circle;
            return (
              <div key={step.key} className="flex flex-1 flex-col items-center text-center">
                <div className="flex w-full items-center">
                  <div className={`h-px flex-1 ${i === 0 ? 'opacity-0' : done ? 'bg-secondary' : 'bg-border'}`} />
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                      done ? 'border-secondary bg-secondary text-white' : 'border-border bg-background text-muted-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div
                    className={`h-px flex-1 ${i === STEPS.length - 1 ? 'opacity-0' : i < stepIdx ? 'bg-secondary' : 'bg-border'}`}
                  />
                </div>
                <span className={`mt-2 text-[11px] font-medium leading-tight ${done ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-8 flex flex-col items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center">
          <XCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">
            This order was {order.status === 'cancelled' ? 'cancelled' : 'not completed'}. Reach out to support if
            you think this is a mistake.
          </p>
        </div>
      )}

      <div className="mt-8">
        <OrderTracking
          orderId={order.id}
          initialTrackingNumber={order.tracking_number}
          initialCourierName={order.courier_name}
        />
      </div>

      <Separator className="my-6" />

      <div className="rounded-lg border border-border/60 bg-card p-4 sm:p-5">
        <h2 className="font-serif text-base font-semibold text-primary">Order Summary</h2>
        <div className="mt-3 divide-y divide-border/60">
          {items.map((item: any, i: number) => (
            <div key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div>
                <p className="font-medium">{item.product_name}</p>
                <p className="text-xs text-muted-foreground">
                  Size: {item.size} · Qty: {item.quantity}
                </p>
              </div>
              <p className="font-medium">{formatINR(item.price * item.quantity)}</p>
            </div>
          ))}
        </div>
        <Separator className="my-3" />
        <div className="flex justify-between text-sm font-semibold">
          <span>{order.payment_method === 'cod' ? 'Total (Pay on Delivery)' : 'Total Paid'}</span>
          <span className="font-serif text-primary">{formatINR(order.total_amount)}</span>
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

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button asChild variant="outline">
          <Link href={`/order-confirmation/${order.id}`}>View Full Order &amp; Invoice</Link>
        </Button>
        <Button asChild className="bg-primary">
          <Link href="/shop">Continue Shopping</Link>
        </Button>
      </div>
    </div>
  );
}
