import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle2, Download, Truck, ShieldCheck } from 'lucide-react';
import { getServerSupabase } from '@/lib/supabase-server';
import { formatINR } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export default async function OrderConfirmationPage({ params }: { params: { id: string } }) {
  const supabase = getServerSupabase();
  const { data: order } = await supabase.from('orders').select('*').eq('id', params.id).single();

  if (!order) notFound();

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
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="rounded-full bg-secondary/20 p-4">
          <CheckCircle2 className="h-10 w-10 text-secondary" />
        </div>
        <h1 className="font-serif text-3xl font-bold text-primary">Thank you for your order!</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Order #{order.id.slice(0, 8).toUpperCase()} has been placed successfully. A confirmation
          email is on its way to {order.customer_email}. Your handwoven pieces will be dispatched
          soon.
        </p>
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
            <span className="text-muted-foreground">GST (5%)</span>
            <span>{formatINR(order.gst_amount ?? 0)}</span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between font-semibold text-foreground">
            <span>Total Paid</span>
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

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild className="bg-primary">
          <Link href="/shop">Continue Shopping</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/account/orders/${order.id}`}>Track this order</Link>
        </Button>
      </div>
    </div>
  );
}
