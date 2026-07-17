import { notFound } from 'next/navigation';
import { getSupabaseServer, getCurrentUser } from '@/lib/supabase-server-auth';
import { formatINR } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import ReturnRequestButton from '@/components/account/return-request-button';

const RETURN_WINDOW_DAYS = 7;

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const supabase = await getSupabaseServer();

  const { data: order } = await supabase.from('orders').select('*').eq('id', params.id).single();
  if (!order || (order.user_id !== user!.id && order.customer_email !== user!.email)) {
    notFound();
  }

  const { data: returns } = await supabase
    .from('returns')
    .select('*')
    .eq('order_id', order.id)
    .order('created_at', { ascending: false });

  const items = Array.isArray(order.items) ? order.items : [];
  const daysSinceOrder =
    (Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60 * 24);
  const eligibleForReturn =
    order.status === 'delivered' && daysSinceOrder <= RETURN_WINDOW_DAYS && !returns?.length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-primary">
            Order #{order.id.slice(0, 8)}
          </h1>
          <p className="text-sm text-muted-foreground">
            Placed on {new Date(order.created_at).toLocaleDateString('en-IN')}
          </p>
        </div>
        <Badge className="bg-muted text-foreground">{order.status}</Badge>
      </div>

      {order.tracking_number && (
        <div className="mt-4 rounded-lg bg-secondary/10 p-4 text-sm">
          <p className="font-medium">Courier: {order.courier_name || 'Assigned'}</p>
          <p className="text-muted-foreground">Tracking #: {order.tracking_number}</p>
        </div>
      )}

      <Separator className="my-6" />

      <h2 className="font-serif text-lg font-semibold">Items</h2>
      <div className="mt-3 divide-y divide-border/60">
        {items.map((item: any, i: number) => (
          <div key={i} className="flex items-center justify-between py-3 text-sm">
            <div>
              <p className="font-medium">{item.product_name}</p>
              <p className="text-muted-foreground">
                Size: {item.size} &middot; Qty: {item.quantity}
              </p>
            </div>
            <p className="font-medium">{formatINR(item.price * item.quantity)}</p>
          </div>
        ))}
      </div>

      <Separator className="my-6" />

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="font-serif text-lg font-semibold">Shipping Address</h2>
          {order.shipping_address && (
            <p className="mt-2 text-sm text-muted-foreground">
              {order.customer_name}
              <br />
              {order.shipping_address.address}
              {order.shipping_address.address2 ? `, ${order.shipping_address.address2}` : ''}
              <br />
              {order.shipping_address.city}, {order.shipping_address.state} -{' '}
              {order.shipping_address.pincode}
              <br />
              Phone: {order.customer_phone}
            </p>
          )}
        </div>
        <div>
          <h2 className="font-serif text-lg font-semibold">Order Summary</h2>
          <div className="mt-2 space-y-1 text-sm text-muted-foreground">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatINR(order.subtotal ?? order.total_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping</span>
              <span>{order.shipping_charge ? formatINR(order.shipping_charge) : 'Free'}</span>
            </div>
            <div className="flex justify-between font-semibold text-foreground">
              <span>Total</span>
              <span>{formatINR(order.total_amount)}</span>
            </div>
          </div>
        </div>
      </div>

      <Separator className="my-6" />

      <div>
        <h2 className="font-serif text-lg font-semibold">Return / Exchange</h2>
        {returns && returns.length > 0 ? (
          <div className="mt-3 space-y-2">
            {returns.map((r) => (
              <div key={r.id} className="rounded-lg border border-border/60 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium capitalize">{r.type} request</span>
                  <Badge className="bg-muted text-foreground">{r.status}</Badge>
                </div>
                <p className="mt-1 text-muted-foreground">Reason: {r.reason}</p>
              </div>
            ))}
          </div>
        ) : eligibleForReturn ? (
          <ReturnRequestButton orderId={order.id} />
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Returns can be requested within {RETURN_WINDOW_DAYS} days of delivery.
          </p>
        )}
      </div>
    </div>
  );
}
