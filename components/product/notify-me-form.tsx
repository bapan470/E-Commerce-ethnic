'use client';

import { useState, FormEvent } from 'react';
import { Bell, CheckCircle2, Loader2 } from 'lucide-react';
import { requestStockNotification } from '@/lib/stock-notify-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function NotifyMeForm({ productId }: { productId: string }) {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const hasEmail = email.trim().length > 0;
    const hasPhone = phone.replace(/\D/g, '').length > 0;
    if (!hasEmail && !hasPhone) {
      toast.error('Enter your email or WhatsApp number');
      return;
    }
    setSubmitting(true);
    try {
      await requestStockNotification(productId, {
        email: hasEmail ? email : undefined,
        phone: hasPhone ? phone : undefined,
      });
      setDone(true);
      toast.success("We'll let you know when it's back in stock");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong, please try again');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        You&apos;re on the list — we&apos;ll message you the moment it&apos;s back.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-border/60 bg-card p-4">
      <p className="text-sm font-semibold">Out of stock? Get notified when it&apos;s back</p>
      <p className="mt-0.5 text-xs text-muted-foreground">Enter your email, WhatsApp number, or both.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          type="tel"
          inputMode="numeric"
          placeholder="WhatsApp number (10 digits)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={submitting} size="lg" variant="outline" className="mt-3 w-full gap-2 sm:w-auto">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
        Notify me
      </Button>
    </form>
  );
}
