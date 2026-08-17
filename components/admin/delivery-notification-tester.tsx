'use client';

import { useState } from 'react';
import { Eye, Send, Loader2, CalendarClock, Truck, PackageCheck, Home, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

// Admin > Orders > (expand a row) > "Test Notifications". Lets you:
//  1. Preview exactly what each lifecycle email looks like (opens the real
//     HTML in a new tab) -- no DB writes, no email sent, safe to click as
//     many times as you want.
//  2. Send a real copy of any of them to an address you type in (e.g. your
//     own inbox) to check how it actually renders in Gmail/Outlook/etc.
//  3. Walk THIS order through the real automatic flow (set an expected
//     delivery date, fire "out for delivery", fire "delivered") -- these
//     ARE the same functions the cron job calls, so it's a true end-to-end
//     test, and they email the order's real customer_email.
export default function DeliveryNotificationTester({
  orderId,
  customerEmail,
  initialExpectedDate,
}: {
  orderId: string;
  customerEmail?: string | null;
  initialExpectedDate?: string | null;
}) {
  const [expectedDate, setExpectedDate] = useState(initialExpectedDate || '');
  const [testTo, setTestTo] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const preview = (type: string) => {
    const url = `/api/admin/orders/${orderId}/preview-email?type=${type}${
      expectedDate ? `&date=${expectedDate}` : ''
    }`;
    window.open(url, '_blank');
  };

  const sendTest = async (type: string) => {
    if (!testTo.trim()) {
      toast.error('Enter an email to send the test to first');
      return;
    }
    setBusy(`send-${type}`);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/preview-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, to: testTo.trim(), date: expectedDate || undefined }),
      });
      if (res.ok) {
        toast.success(`Test "${type}" email sent to ${testTo.trim()}`);
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || 'Failed to send test email');
      }
    } catch {
      toast.error('Failed to send test email');
    } finally {
      setBusy(null);
    }
  };

  const runAction = async (action: string, extra: Record<string, any> = {}) => {
    setBusy(action);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/delivery-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error || 'Action failed');
      } else if (body.skipped) {
        toast.info(`Skipped: ${body.skipped}`);
      } else if (body.sent) {
        toast.success('Real email sent to the customer for this order');
      } else {
        toast.success('Done');
      }
    } catch {
      toast.error('Action failed');
    } finally {
      setBusy(null);
    }
  };

  const emailTypes: { key: string; label: string; icon: any }[] = [
    { key: 'paid', label: 'Payment Confirmed', icon: Wallet },
    { key: 'shipped', label: 'Shipped', icon: Truck },
    { key: 'arriving', label: 'Arriving', icon: CalendarClock },
    { key: 'out_for_delivery', label: 'Out for Delivery', icon: Truck },
    { key: 'delivered', label: 'Delivered', icon: Home },
  ];

  return (
    <div className="rounded-lg border border-dashed border-secondary/50 bg-secondary/5 p-4">
      <h4 className="mb-1 text-sm font-semibold">Test Notifications</h4>
      <p className="mb-3 text-xs text-muted-foreground">
        Preview any email's design, send a test copy to your own inbox, or actually walk this order through the
        real automatic flow (emails the order's real customer:{' '}
        <span className="font-medium">{customerEmail || 'no email on this order'}</span>).
      </p>

      {/* Preview + send-test row */}
      <div className="grid gap-2">
        {emailTypes.map(({ key, label, icon: Icon }) => (
          <div key={key} className="flex flex-wrap items-center gap-2">
            <span className="flex w-40 items-center gap-1.5 text-xs font-medium">
              <Icon className="h-3.5 w-3.5 text-secondary" /> {label}
            </span>
            <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => preview(key)}>
              <Eye className="h-3.5 w-3.5" /> Preview
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={busy === `send-${key}`}
              onClick={() => sendTest(key)}
            >
              {busy === `send-${key}` ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Send test
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <label className="text-xs font-medium text-muted-foreground">Send test copies to</label>
        <Input
          type="email"
          placeholder="you@example.com"
          value={testTo}
          onChange={(e) => setTestTo(e.target.value)}
          className="mt-1 h-8 max-w-xs text-sm"
        />
      </div>

      <div className="my-4 border-t border-border/60" />

      {/* Real, end-to-end simulation */}
      <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Simulate real flow on this order
      </h5>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Expected delivery date</label>
          <Input
            type="date"
            value={expectedDate}
            onChange={(e) => setExpectedDate(e.target.value)}
            className="mt-1 h-8 text-sm"
          />
        </div>
        <Button
          type="button"
          size="sm"
          disabled={busy === 'send_arriving' || !expectedDate}
          onClick={() => runAction('send_arriving', { date: expectedDate, force: true })}
          className="gap-1.5"
        >
          {busy === 'send_arriving' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="h-3.5 w-3.5" />}
          Save date &amp; send "Arriving" now
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy === 'send_out_for_delivery'}
          onClick={() => runAction('send_out_for_delivery', { force: true })}
          className="gap-1.5"
        >
          {busy === 'send_out_for_delivery' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Truck className="h-3.5 w-3.5" />
          )}
          Mark "Out for Delivery" now
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy === 'send_delivered'}
          onClick={() => runAction('send_delivered', { force: true })}
          className="gap-1.5"
        >
          {busy === 'send_delivered' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <PackageCheck className="h-3.5 w-3.5" />
          )}
          Mark "Delivered" now
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        These buttons send real emails to the customer above and (for "Out for Delivery" / "Delivered") update the
        order's actual status — use a test order if you don't want to touch a real customer's order.
      </p>
    </div>
  );
}
