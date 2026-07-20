import { ShieldCheck, Lock, RotateCcw, Headset } from 'lucide-react';

/**
 * Checkout trust signals — sits right below the "Place Order" button.
 * Pure presentational, no data dependency, so it's safe to drop in anywhere.
 */
export default function TrustBadges() {
  return (
    <div className="mt-5 flex flex-col gap-4">
      {/* Reassurance strip: SSL / secure payment / easy returns / support */}
      <div className="grid grid-cols-2 gap-2.5 rounded-md border border-border/60 bg-muted/30 p-3 sm:grid-cols-4">
        <div className="flex flex-col items-center gap-1 text-center">
          <ShieldCheck className="h-5 w-5 text-secondary" />
          <span className="text-[10px] font-medium leading-tight text-muted-foreground">
            100% Secure
            <br />
            Payment
          </span>
        </div>
        <div className="flex flex-col items-center gap-1 text-center">
          <Lock className="h-5 w-5 text-secondary" />
          <span className="text-[10px] font-medium leading-tight text-muted-foreground">
            SSL Encrypted
            <br />
            Checkout
          </span>
        </div>
        <div className="flex flex-col items-center gap-1 text-center">
          <RotateCcw className="h-5 w-5 text-secondary" />
          <span className="text-[10px] font-medium leading-tight text-muted-foreground">
            Easy 7-Day
            <br />
            Returns
          </span>
        </div>
        <div className="flex flex-col items-center gap-1 text-center">
          <Headset className="h-5 w-5 text-secondary" />
          <span className="text-[10px] font-medium leading-tight text-muted-foreground">
            Dedicated
            <br />
            Support
          </span>
        </div>
      </div>

      {/* Payment method row */}
      <div className="flex flex-col items-center gap-2">
        <p className="text-[11px] text-muted-foreground">Safe & secure payments powered by</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {['Razorpay', 'UPI', 'Visa', 'Mastercard', 'RuPay', 'Net Banking'].map((method) => (
            <span
              key={method}
              className="rounded border border-border/60 bg-background px-2 py-1 text-[10px] font-semibold tracking-wide text-foreground/70"
            >
              {method}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
