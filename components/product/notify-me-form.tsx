'use client';

import { useState, FormEvent } from 'react';
import { Bell, CheckCircle2, Loader2 } from 'lucide-react';
import { requestStockNotification } from '@/lib/stock-notify-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function NotifyMeForm({ productId }: { productId: string }) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    setSubmitting(true);
    try {
      await requestStockNotification(productId, email);
      setDone(true);
      toast.success("We'll email you when it's back in stock");
    } catch (err) {
      toast.error('Something went wrong, please try again');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-1 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        You&apos;re on the list — we&apos;ll email you when it&apos;s back.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-2 sm:flex-row">
      <Input
        type="email"
        required
        placeholder="Your email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="flex-1"
      />
      <Button type="submit" disabled={submitting} size="lg" variant="outline" className="gap-2">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
        Notify me
      </Button>
    </form>
  );
}
