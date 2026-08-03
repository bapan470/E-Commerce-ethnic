import Link from 'next/link';
import type { Metadata } from 'next';
import { LogIn, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Public, crawlable landing page for the "reseller login" search intent.
// /account/reseller requires login (middleware redirects logged-out
// visitors, including Googlebot, to /login) so it can't rank for this
// keyword directly. This page lives outside /account on purpose.
export const metadata: Metadata = {
  title: 'Reseller Login — AruhiHandlooms Reseller Dashboard',
  description:
    'Log in to your AruhiHandlooms reseller account to track orders, manage your markup, and view earnings from your reseller dashboard.',
  alternates: { canonical: '/reseller-login' },
};

export default function ResellerLoginPage() {
  return (
    <div className="container-boutique max-w-xl py-14 sm:py-20">
      <nav className="mb-8 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-secondary">Home</Link>
        <span className="mx-1">/</span>
        <span>Reseller Login</span>
      </nav>

      <div className="rounded-lg border border-border/60 bg-gradient-to-br from-primary/5 to-secondary/5 p-8 text-center">
        <TrendingUp className="mx-auto h-9 w-9 text-primary" />
        <h1 className="mt-3 font-serif text-3xl font-bold text-primary">Reseller Login</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Resellers log in with their regular AruhiHandlooms account. Once logged in,
          you&apos;ll be taken straight to your reseller dashboard to track orders and earnings.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/login?next=/account/reseller">
            <Button className="bg-primary">
              <LogIn className="mr-2 h-4 w-4" />
              Log In to Reseller Dashboard
            </Button>
          </Link>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Not a reseller yet?{' '}
          <Link href="/reseller-registration" className="underline hover:text-secondary">
            Register as a reseller
          </Link>
        </p>
      </div>
    </div>
  );
}
