'use client';

import { useState, FormEvent, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/account';
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [referredByCode, setReferredByCode] = useState(searchParams.get('ref') || '');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const fullName = fd.get('fullName') as string;
    const email = fd.get('email') as string;
    const password = fd.get('password') as string;

    setLoading(true);
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, email, password, next, referredByCode: referredByCode || undefined }),
    });
    const result = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      toast.error(result.error || 'Something went wrong. Please try again.');
      return;
    }

    toast.success('Check your email to confirm your account, then log in.');
    router.push('/login');
  };

  const onGoogle = async () => {
    setGoogleLoading(true);
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      toast.error(error.message);
      setGoogleLoading(false);
    }
  };

  return (
    <div className="relative min-h-[70vh] overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/80 md:flex md:min-h-[70vh] md:items-center md:justify-center md:bg-none md:py-16">
      {/* Decorative brand panel — mobile only, sits behind the sheet below */}
      <div className="flex flex-col items-center gap-2 px-6 pb-44 pt-16 text-center text-primary-foreground md:hidden">
        <span className="font-serif text-3xl font-bold text-secondary">Aruhi</span>
        <p className="text-sm text-primary-foreground/80">
          Get personalised suggestions, offers &amp; more
        </p>
      </div>

      {/* Signup card — fixed bottom sheet on mobile, centered card on desktop */}
      <div className="fixed inset-x-0 bottom-0 z-10 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-background p-6 shadow-[0_-8px_24px_rgba(0,0,0,0.12)] md:static md:z-auto md:max-h-none md:w-full md:max-w-sm md:rounded-2xl md:border md:border-border/60 md:p-8 md:shadow-none">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border md:hidden" />

        <div className="text-center">
          <h1 className="font-serif text-2xl font-bold text-primary md:text-3xl">
            Create your account
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Join Aruhi Handlooms for faster checkout &amp; order tracking
          </p>
        </div>

        <div className="mt-5 space-y-5">
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={onGoogle}
            disabled={googleLoading}
          >
            {googleLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Continue with Google
          </Button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" name="fullName" required placeholder="Priya Sharma" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required placeholder="you@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <PasswordInput id="password" name="password" required minLength={6} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="referredByCode">
                Referral code <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="referredByCode"
                name="referredByCode"
                value={referredByCode}
                onChange={(e) => setReferredByCode(e.target.value.toUpperCase())}
                placeholder="e.g. PRIYA4F2K"
                className="uppercase"
              />
            </div>
            <Button type="submit" className="w-full bg-primary" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create account
            </Button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
