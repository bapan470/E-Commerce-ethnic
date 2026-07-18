'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { Loader2, Mail } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const email = fd.get('email') as string;

    setLoading(true);
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/reset-password')}`,
    });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  };

  return (
    <div className="container-boutique flex min-h-[70vh] items-center justify-center py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="font-serif text-3xl font-bold text-primary">Reset your password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {sent
              ? "We've sent you a reset link"
              : "Enter your email and we'll send you a link to reset your password"}
          </p>
        </div>

        {sent ? (
          <div className="space-y-4 rounded-lg border border-border bg-card p-5 text-center">
            <Mail className="mx-auto h-8 w-8 text-primary" />
            <p className="text-sm text-muted-foreground">
              Check your inbox (and spam folder) for a link to reset your password. The link
              expires shortly, so use it soon.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required placeholder="you@example.com" />
            </div>
            <Button type="submit" className="w-full bg-primary" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send reset link
            </Button>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-primary hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
