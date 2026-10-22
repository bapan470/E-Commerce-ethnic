'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { formatINR } from '@/lib/format';

// Shown under "Complete Payment" on /checkout/resume/[id] for orders the
// admin asked to pay online: the customer can instead keep Cash on Delivery
// or cancel the order. Talks to /api/orders/[id]/payment-choice.
export default function ResumePaymentChoices({
  orderId,
  codTotal,
}: {
  orderId: string;
  codTotal: number;
}) {
  const [busy, setBusy] = useState<null | 'keep_cod' | 'cancel'>(null);
  const [done, setDone] = useState<null | 'keep_cod' | 'cancel'>(null);

  const submit = async (choice: 'keep_cod' | 'cancel') => {
    const ok = window.confirm(
      choice === 'keep_cod'
        ? `Keep this order as Cash on Delivery? You will pay ${formatINR(codTotal)} on delivery.`
        : 'Are you sure you want to cancel this order?'
    );
    if (!ok) return;
    setBusy(choice);
    try {
      const res = await fetch(`/api/orders/${orderId}/payment-choice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ choice }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
      setDone(choice);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  if (done) {
    return (
      <div className="mt-6 rounded-lg border border-border/60 bg-card p-4 text-center text-sm">
        {done === 'keep_cod' ? (
          <>
            <p className="font-medium text-primary">Thank you — your order stays as Cash on Delivery.</p>
            <p className="mt-1 text-muted-foreground">
              Please keep {formatINR(codTotal)} ready at the time of delivery. We will begin preparing your piece shortly.
            </p>
          </>
        ) : (
          <>
            <p className="font-medium text-primary">Your order has been cancelled.</p>
            <p className="mt-1 text-muted-foreground">No payment was taken. We hope to serve you again soon.</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="mt-6 border-t border-border/60 pt-5 text-center">
      <p className="text-xs text-muted-foreground">Prefer not to pay online?</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Button variant="outline" disabled={!!busy} onClick={() => submit('keep_cod')} className="gap-2">
          {busy === 'keep_cod' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Keep Cash on Delivery
        </Button>
        <Button
          variant="ghost"
          disabled={!!busy}
          onClick={() => submit('cancel')}
          className="gap-2 text-muted-foreground hover:text-destructive"
        >
          {busy === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Cancel order
        </Button>
      </div>
    </div>
  );
}
