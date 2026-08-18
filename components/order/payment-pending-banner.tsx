import Link from 'next/link';
import { AlertTriangle, CreditCard, ShieldCheck, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatINR } from '@/lib/format';

interface PaymentPendingBannerProps {
  orderId: string;
  totalAmount: number;
  originalPaymentMethod?: string | null;
  onlinePaymentDiscount?: number | null;
  /** Where this banner appears — affects the resume link source param */
  source?: 'track' | 'confirmation' | 'account';
}

/**
 * Eye-catching "payment pending" banner shown on the Track Order page,
 * Order Confirmation page, and My Orders list whenever the order status
 * is 'pending' and payment_method is not COD.
 *
 * Design goal: customer sees this banner and immediately understands
 * (a) there is something urgent to do, (b) what exactly to do, and
 * (c) their money is safe.
 */
export default function PaymentPendingBanner({
  orderId,
  totalAmount,
  originalPaymentMethod,
  onlinePaymentDiscount,
  source = 'track',
}: PaymentPendingBannerProps) {
  const wasConvertedFromCod = originalPaymentMethod === 'cod';
  const resumeHref = `/checkout/resume/${orderId}?src=${source}`;

  return (
    <div className="relative overflow-hidden rounded-xl border-2 border-amber-400 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 shadow-sm">
      {/* Accent top bar */}
      <div className="h-1 w-full bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500" />

      <div className="p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-amber-900">
              {wasConvertedFromCod
                ? '⚠️ Action required — Online payment needed'
                : '⏳ Payment pending — Order not confirmed yet'}
            </p>

            {wasConvertedFromCod ? (
              <div className="mt-2 space-y-2 text-sm text-amber-800">
                <p>
                  This particular piece is handcrafted to order and cannot be sent Cash on
                  Delivery. Please complete the online payment so we can begin weaving it for
                  you. We&apos;re sorry for the extra step — and truly grateful for your
                  patience.
                </p>
                <p>
                  Your payment is fully protected under our{' '}
                  <Link
                    href="/legal/refund-policy"
                    className="font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-700"
                  >
                    Refund &amp; Cancellation Policy
                  </Link>
                  .
                </p>
              </div>
            ) : (
              <p className="mt-1 text-sm text-amber-800">
                Nothing has been charged yet. Complete the payment to confirm your order and get
                your handwoven saree on its way.
              </p>
            )}
          </div>
        </div>

        {/* Discount highlight */}
        {onlinePaymentDiscount && onlinePaymentDiscount > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm font-medium text-green-800">
            <span className="text-base">🎁</span>
            You save <span className="font-bold text-green-700">{formatINR(onlinePaymentDiscount)}</span> by
            paying online — already applied to your total.
          </div>
        )}

        {/* Trust pills + CTA */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-xs text-amber-700">
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" /> 100% secure payment
            </span>
            <span className="flex items-center gap-1">
              <CreditCard className="h-3.5 w-3.5" /> UPI · Cards · Net Banking
            </span>
          </div>
          <Button
            asChild
            className="shrink-0 bg-amber-600 text-white hover:bg-amber-700 gap-1.5 shadow-sm"
            size="sm"
          >
            <Link href={resumeHref}>
              Complete Payment — {formatINR(totalAmount)}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
