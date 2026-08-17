import Link from 'next/link';
import Image from 'next/image';
import { Package } from 'lucide-react';
import { getSupabaseServer, getCurrentUser } from '@/lib/supabase-server-auth';
import { formatINR } from '@/lib/format';
import { Badge } from '@/components/ui/badge';

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
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/account/orders/${order.id}`}
              className="block rounded-lg border border-border/60 p-4 transition-colors hover:border-primary/40 hover:bg-muted/30"
            >
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
              {/* Same "was COD, converted via Request Online Payment"
                  case as /account/orders/[id] -- shown here too, right at
                  the top of the card, so it's visible without opening the
                  order. */}
              {order.status === 'pending' &&
                order.payment_method !== 'cod' &&
                order.original_payment_method === 'cod' && (
                  <p className="mt-2 rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
                    This particular piece isn&apos;t kept ready-made at all times — it&apos;s specially
                    prepared once an order comes in. Because of that, we&apos;re not able to offer Cash
                    on Delivery on this order, and need the payment made online before we start
                    preparing it.
                  </p>
                )}
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
          ))}
        </div>
      )}
    </div>
  );
}
