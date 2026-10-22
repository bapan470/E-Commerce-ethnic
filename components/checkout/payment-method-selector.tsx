'use client';

import { Check, CreditCard, Info, Lock, Sparkles, Truck, Wallet, Zap, BadgeCheck, Split } from 'lucide-react';
import { formatINR } from '@/lib/format';

/**
 * Premium payment-method picker for checkout.
 *
 * Design / compliance notes (please keep when editing):
 *  - Both options are always visible, equally selectable, and each one shows
 *    the EXACT amount the customer will pay. Nothing is hidden or disabled
 *    to push people toward prepaid.
 *  - The prepaid saving is a plain, disclosed discount (also shown as a line
 *    item in the Order Summary). Merchant Center feed / structured data
 *    should keep the normal selling price.
 *  - The benefit copy below (priority dispatch / faster delivery) must stay
 *    TRUE in your day-to-day operations and match your Shipping Policy page.
 *    If you ever stop prioritising prepaid orders, edit PAYMENT_COPY here.
 *    No fixed delivery-day numbers are promised on purpose.
 */
export const PAYMENT_COPY = {
  onlineTitle: 'Pay Online',
  onlineSub: 'UPI, cards & netbanking · secured by Razorpay',
  onlineNote: 'Prepaid orders are confirmed instantly and packed ahead of COD orders.',
  benefits: [
    { icon: 'zap', title: 'Dispatched first', sub: 'Priority packing' },
    { icon: 'truck', title: 'Reaches you sooner', sub: 'Ships ahead of COD' },
    { icon: 'check', title: 'Instant confirmation', sub: 'No verification wait' },
  ],
  codTitle: 'Cash on Delivery',
  codSub: 'Pay in cash when your order arrives',
  partialNote:
    'Your order is confirmed once the advance is paid. The balance is paid to the delivery partner in cash or UPI. The online-payment discount applies only to full prepaid orders.',
  codNote:
    'We will send a one-tap confirmation link by email/WhatsApp. COD orders are dispatched after prepaid orders, so delivery can take a little longer.',
} as const;

const BENEFIT_ICONS = {
  zap: Zap,
  truck: Truck,
  check: BadgeCheck,
} as const;

export type CheckoutPaymentMethod = 'online' | 'cod' | 'partial';

/** Shown only when Partial Pay is enabled (Admin > Settings) and this order is eligible. */
export interface PartialPayOption {
  title: string;
  percent: number;
  /** Paid online now. */
  advance: number;
  /** Paid to the courier on delivery. */
  balance: number;
}

interface PaymentMethodSelectorProps {
  value: CheckoutPaymentMethod;
  onChange: (method: CheckoutPaymentMethod) => void;
  partial?: PartialPayOption | null;
  /** Rupees saved by paying online (0 / undefined hides all saving UI). */
  savings: number;
  /** Final amount if the customer pays online. */
  onlineTotal: number;
  /** Final amount if the customer chooses COD. */
  codTotal: number;
}

function RadioDot({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden
      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 ${
        selected
          ? 'scale-100 border-primary bg-primary text-primary-foreground'
          : 'border-border bg-background'
      }`}
    >
      <Check
        className={`h-3 w-3 transition-opacity duration-200 ${selected ? 'opacity-100' : 'opacity-0'}`}
        strokeWidth={3}
      />
    </span>
  );
}

export default function PaymentMethodSelector({
  value,
  onChange,
  partial,
  savings,
  onlineTotal,
  codTotal,
}: PaymentMethodSelectorProps) {
  const online = value === 'online';
  const cod = value === 'cod';
  const part = value === 'partial';
  const hasSavings = savings > 0;

  return (
    <div role="radiogroup" aria-label="Payment method" className="flex flex-col gap-3.5">
      {/* ───────── Pay Online (recommended) ───────── */}
      <div className="relative pt-2.5">
        {hasSavings && (
          <span className="absolute left-4 top-0 z-20 inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-secondary-foreground shadow-sm">
            <Sparkles className="h-3 w-3" />
            Recommended · Save {formatINR(savings)}
          </span>
        )}
        {!hasSavings && (
          <span className="absolute left-4 top-0 z-20 inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-secondary-foreground shadow-sm">
            <Sparkles className="h-3 w-3" />
            Recommended
          </span>
        )}

        <button
          type="button"
          role="radio"
          aria-checked={online}
          onClick={() => onChange('online')}
          className={`relative w-full overflow-hidden rounded-xl border-2 p-4 pt-5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
            online
              ? 'border-primary bg-gradient-to-br from-primary/[0.07] via-card to-secondary/15 shadow-[0_10px_30px_-14px_hsl(var(--primary)/0.55)]'
              : 'border-secondary/50 bg-card hover:border-primary/50'
          }`}
        >
          {/* gold sweep only while it is NOT selected, to draw the eye */}
          {!online && hasSavings && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-1/3 animate-shine-sweep bg-gradient-to-r from-transparent via-secondary/35 to-transparent motion-reduce:animate-none"
            />
          )}

          <div className="relative z-10 flex items-start gap-3">
            <RadioDot selected={online} />
            <CreditCard className="mt-0.5 hidden h-5 w-5 shrink-0 text-secondary sm:block" />
            <div className="min-w-0 flex-1">
              <p className="font-serif text-base font-bold text-primary">{PAYMENT_COPY.onlineTitle}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{PAYMENT_COPY.onlineSub}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-serif text-lg font-bold leading-tight text-primary">{formatINR(onlineTotal)}</p>
              {hasSavings && (
                <p className="mt-0.5 inline-block rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-800">
                  You save {formatINR(savings)}
                </p>
              )}
            </div>
          </div>

          {/* Benefits — always visible so the reason to pay online is clear */}
          <div className="relative z-10 mt-3.5 grid grid-cols-3 gap-2">
            {PAYMENT_COPY.benefits.map((b) => {
              const Icon = BENEFIT_ICONS[b.icon];
              return (
                <div
                  key={b.title}
                  className={`flex flex-col items-center gap-1 rounded-lg border px-1.5 py-2 text-center transition-colors ${
                    online ? 'border-secondary/50 bg-secondary/10' : 'border-border/60 bg-muted/30'
                  }`}
                >
                  <Icon className="h-4 w-4 text-secondary" />
                  <span className="text-[11px] font-semibold leading-tight text-foreground">{b.title}</span>
                  <span className="text-[10px] leading-tight text-muted-foreground">{b.sub}</span>
                </div>
              );
            })}
          </div>

          <p className="relative z-10 mt-3 flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
            <Lock className="mt-px h-3 w-3 shrink-0 text-secondary" />
            {PAYMENT_COPY.onlineNote}
          </p>
        </button>
      </div>

      {/* ───────── Partial Pay (advance online, rest on delivery) ───────── */}
      {partial && (
        <div>
          <button
            type="button"
            role="radio"
            aria-checked={part}
            onClick={() => onChange('partial')}
            className={`w-full rounded-xl border-2 p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
              part
                ? 'border-primary bg-gradient-to-br from-primary/[0.06] via-card to-card shadow-[0_10px_30px_-16px_hsl(var(--primary)/0.5)]'
                : 'border-border/70 bg-card hover:border-primary/40'
            }`}
          >
            <div className="flex items-start gap-3">
              <RadioDot selected={part} />
              <Split className="mt-0.5 hidden h-5 w-5 shrink-0 text-secondary sm:block" />
              <div className="min-w-0 flex-1">
                <p className="font-serif text-base font-bold text-foreground">{partial.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Pay {partial.percent}% now, the rest when your order arrives
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-serif text-lg font-bold leading-tight text-foreground">{formatINR(partial.advance)}</p>
                <p className="text-[10px] text-muted-foreground">now</p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg border border-border/60 bg-muted/30 px-2 py-2">
                <p className="text-[10px] text-muted-foreground">Pay online now</p>
                <p className="text-sm font-semibold text-foreground">{formatINR(partial.advance)}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/30 px-2 py-2">
                <p className="text-[10px] text-muted-foreground">Pay on delivery</p>
                <p className="text-sm font-semibold text-foreground">{formatINR(partial.balance)}</p>
              </div>
            </div>

            {part && (
              <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] leading-snug text-amber-900">
                <Info className="mt-px h-3.5 w-3.5 shrink-0" />
                {PAYMENT_COPY.partialNote}
              </p>
            )}
          </button>
        </div>
      )}

      {/* ───────── Cash on Delivery ───────── */}
      <div>
        <button
          type="button"
          role="radio"
          aria-checked={cod}
          onClick={() => onChange('cod')}
          className={`w-full rounded-xl border-2 p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
            cod
              ? 'border-primary bg-gradient-to-br from-primary/[0.06] via-card to-card shadow-[0_10px_30px_-16px_hsl(var(--primary)/0.5)]'
              : 'border-border/70 bg-card hover:border-primary/40'
          }`}
        >
          <div className="flex items-start gap-3">
            <RadioDot selected={cod} />
            <Wallet className="mt-0.5 hidden h-5 w-5 shrink-0 text-secondary sm:block" />
            <div className="min-w-0 flex-1">
              <p className="font-serif text-base font-bold text-foreground">{PAYMENT_COPY.codTitle}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{PAYMENT_COPY.codSub}</p>
            </div>
            <p className="shrink-0 font-serif text-lg font-bold leading-tight text-foreground">
              {formatINR(codTotal)}
            </p>
          </div>

          {cod && (
            <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] leading-snug text-amber-900">
              <Info className="mt-px h-3.5 w-3.5 shrink-0" />
              {PAYMENT_COPY.codNote}
            </p>
          )}
        </button>

        {/* Separate button (not nested inside the card button) */}
        {cod && hasSavings && (
          <button
            type="button"
            onClick={() => onChange('online')}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-secondary/60 bg-secondary/10 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-secondary/20"
          >
            <Zap className="h-3.5 w-3.5 text-secondary" />
            Switch to online payment &amp; save {formatINR(savings)}
          </button>
        )}
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        {partial ? 'Same product price on every option — the online-payment discount applies to full online payment only.' : 'Same price either way — the only difference is the online-payment discount shown above.'}
      </p>
    </div>
  );
}
