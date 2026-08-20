import Image from 'next/image';
import { notFound } from 'next/navigation';
import { CreditCard } from 'lucide-react';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { formatINR } from '@/lib/format';
import ResumePaymentButton from '@/components/checkout/resume-payment-button';
import { isInPaymentRequestFlow, logPaymentRequestEvent, type PaymentRequestSource } from '@/lib/order-payment-events';
import { toPublicMediaUrl } from '@/lib/media-url';

// Landing page for the "complete your payment" reminder email
// (lib/email-templates.ts -> paymentReminderEmail), for the admin's
// "Request Online Payment" flow (?src=email from the click-tracking
// redirect, ?src=account from the account order page's "Complete
// Payment" button), and for anyone who just wants to retry payment on
// an order they abandoned mid-checkout. Same security model as
// /order-confirmation/[id]: the order id itself (an unguessable UUID)
// is the access token, exactly like every other order-lookup-by-id page.
export default async function ResumePaymentPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { src?: string };
}) {
  const supabase = getSupabaseAdmin();
  const { data: order } = await supabase
    .from('orders')
    .select(
      'id, status, payment_method, items, total_amount, online_payment_discount, customer_name, customer_email, customer_phone'
    )
    .eq('id', params.id)
    .maybeSingle();

  if (!order) notFound();

  // Already paid — send them straight to the confirmation page instead of
  // showing a "pay now" button for an order that's already done.
  if (order.status === 'paid') {
    const { redirect } = await import('next/navigation');
    redirect(`/order-confirmation/${order.id}`);
  }

  // Anything that isn't a still-payable online order (cancelled, failed,
  // shipped, or a COD order that was never meant to be paid online here)
  // doesn't belong on this page.
  if (order.status !== 'pending' || order.payment_method === 'cod') {
    notFound();
  }

  // Only log into order_payment_request_events for orders that actually
  // went through Admin > "Request Online Payment" -- an ordinary
  // abandoned-checkout retry (no admin conversion involved) shouldn't
  // show up in that timeline. Best-effort, never blocks the page render.
  const src = searchParams?.src === 'email' || searchParams?.src === 'account' ? (searchParams.src as PaymentRequestSource) : undefined;
  try {
    if (await isInPaymentRequestFlow(order.id)) {
      await logPaymentRequestEvent(order.id, 'page_visited', { source: src });
    }
  } catch {
    // best-effort — never block the page render
  }

  const items = Array.isArray(order.items) ? order.items : [];

  return (
    <div className="container-boutique max-w-lg py-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="rounded-full bg-secondary/20 p-4">
          <CreditCard className="h-10 w-10 text-secondary" />
        </div>
        <h1 className="font-serif text-2xl font-bold text-primary">Complete your payment</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Your order #{order.id.slice(0, 8).toUpperCase()} is saved and waiting — nothing has been
          charged yet. Finish the payment below to confirm it.
        </p>
      </div>

      <div className="mt-8 rounded-lg border border-border/60 bg-card p-4">
        {items.map((item: any, idx: number) => {
          const img = toPublicMediaUrl(item.image_url || item.image || item.images?.[0]) || '';
          return (
            <div
              key={idx}
              className="flex items-center gap-3 border-b border-border/40 py-3 last:border-b-0"
            >
              <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                {img ? (
                  <Image src={img} alt={item.product_name || ''} fill className="object-cover" />
                ) : null}
              </div>
              <div className="flex-1 text-sm">
                <div className="font-medium">{item.product_name}</div>
                <div className="text-xs text-muted-foreground">
                  {item.color ? `${item.color} · ` : ''}
                  {item.size ? `${item.size} · ` : ''}Qty {item.quantity}
                </div>
              </div>
              <div className="text-sm font-medium">{formatINR((item.price || 0) * (item.quantity || 1))}</div>
            </div>
          );
        })}
        {order.online_payment_discount > 0 ? (
          <div className="space-y-1.5 border-t border-border/60 pt-3">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>COD total</span>
              <span className="line-through">
                {formatINR(order.total_amount + order.online_payment_discount)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm text-green-700">
              <span>Online payment discount</span>
              <span>-{formatINR(order.online_payment_discount)}</span>
            </div>
            <div className="flex items-center justify-between text-base font-bold">
              <span>Total</span>
              <span>{formatINR(order.total_amount)}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between border-t border-border/60 pt-3 text-base font-bold">
            <span>Total</span>
            <span>{formatINR(order.total_amount)}</span>
          </div>
        )}
      </div>

      {order.online_payment_discount > 0 && (
        <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-center text-xs text-green-800">
          You&apos;re saving {formatINR(order.online_payment_discount)} by paying online instead of Cash on
          Delivery.
        </p>
      )}

      <div className="mt-6">
        <ResumePaymentButton
          orderId={order.id}
          customerName={order.customer_name ?? undefined}
          customerEmail={order.customer_email ?? undefined}
          customerPhone={order.customer_phone ?? undefined}
        />
      </div>
    </div>
  );
}
