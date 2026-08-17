import Link from 'next/link';
import Image from 'next/image';
import { Package, CreditCard } from 'lucide-react';
import { getSupabaseServer, getCurrentUser } from '@/lib/supabase-server-auth';
import { formatINR } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const STATUS_VARIANT: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-blue-100 text-blue-800',
  paid: 'bg-blue-100 text-blue-800',
  shipped: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  returned: 'bg-gray-200 text-gray-800',
  failed: 'bg-red-100 text-red-800',
};

export default async function OrdersPage() {
  const user = await getCurrentUser();
  const supabase = await getSupabaseServer();

  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .or(`user_id.eq.${user!.id},customer_email.ilike.${user!.email}`)
    // Orders a reseller placed on behalf of their own customers show up
    // in the Reseller dashboard instead, not mixed into personal orders.
    .eq('is_reseller_order', false)
    .order('created_at', { ascending: false });

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold text-primary">My Orders</h1>

      {!orders || orders.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center text-muted-foreground">
          <Package className="h-10 w-10" />
          <p>You haven&apos;t placed any orders yet.</p>
          <Link href="/shop" className="text-sm font-medium text-primary hover:underline">
            Start shopping
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {orders.map((order) => {
            // A 'pending' + non-COD order always means "nothing's been
            // charged yet" -- either an ordinary online order the
            // customer abandoned mid-checkout, or a COD order Admin
            // converted via "Request Online Payment" (Admin > Orders).
            // Both need the same "why is this pending" explanation and a
            // way to pay, shown right here on the list -- previously this
            // only appeared after opening the order, so a customer who
            // never opened the reminder email and only glances at this
            // list had no idea why it said "pending" or what to do about
            // it.
            const isUnpaidPending = order.status === 'pending' && order.payment_method !== 'cod';
            const wasConvertedFromCod = isUnpaidPending && order.original_payment_method === 'cod';

            return (
              <div
                key={order.id}
                className="rounded-lg border border-border/60 p-4 transition-colors hover:border-primary/40 hover:bg-muted/30"
              >
                <Link href={`/account/orders/${order.id}`} className="block">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">Order #{order.id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">
                        Placed on {new Date(order.created_at).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                    <Badge className={STATUS_VARIANT[order.status] ?? 'bg-muted'}>
                      {order.status}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-2">
                        {(Array.isArray(order.items) ? order.items : []).slice(0, 3).map((item: any, i: number) => (
                          <div
                            key={i}
                            className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border-2 border-background bg-muted"
                          >
                            <Image
                              src={item.image_url || 'https://placehold.co/80x80?text=No+Image'}
                              alt={item.product_name || 'Product'}
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          </div>
                        ))}
                        {Array.isArray(order.items) && order.items.length > 3 && (
                          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-md border-2 border-background bg-muted text-xs font-medium text-muted-foreground">
                            +{order.items.length - 3}
                          </div>
                        )}
                      </div>
                      <span className="text-muted-foreground">
                        {Array.isArray(order.items) ? order.items.length : 0} item(s)
                      </span>
                    </div>
                    <span className="font-semibold text-primary">
                      {formatINR(order.total_amount)}
                    </span>
                  </div>
                </Link>

                {isUnpaidPending && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md bg-amber-50 p-3">
                    <div className="flex gap-2 text-xs text-amber-900">
                      <CreditCard className="h-4 w-4 shrink-0 text-amber-600" />
                      {wasConvertedFromCod ? (
                        <div className="space-y-1.5">
                          <p>
                            This particular piece isn&apos;t kept ready-made at all times — it&apos;s
                            specially prepared once an order comes in. Because of that, we&apos;re not
                            able to offer Cash on Delivery on this order, and kindly request the
                            payment be made online before we begin preparing it. We&apos;re sorry for
                            the extra step, and truly appreciate your patience here.
                          </p>
                          <p>
                            Your payment is fully protected — if anything about this order doesn&apos;t
                            work out, it&apos;s covered under our{' '}
                            <Link
                              href="/legal/refund-policy"
                              onClick={(e) => e.stopPropagation()}
                              className="font-medium text-amber-950 underline underline-offset-2"
                            >
                              Refund &amp; Cancellation Policy
                            </Link>
                            , and we&apos;re always here if you have questions.
                          </p>
                        </div>
                      ) : (
                        <p>Nothing&apos;s been charged yet — complete the payment to confirm this order.</p>
                      )}
                    </div>
                    <Button asChild size="sm" className="shrink-0">
                      <Link href={`/checkout/resume/${order.id}?src=account`}>Complete Payment</Link>
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
