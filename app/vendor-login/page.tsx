import Link from 'next/link';
import type { Metadata } from 'next';
import { LogIn, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Public, crawlable landing page for the "vendor login" search intent.
// The real /vendor/* routes are behind auth middleware, so a logged-out
// visitor (including Googlebot) is always bounced to /login before ever
// seeing content — meaning nothing under /vendor/* can rank for this
// keyword. This page lives outside that protected path on purpose.
export const metadata: Metadata = {
  title: 'Vendor Login — AruhiHandlooms Vendor Dashboard',
  description:
    'Log in to your AruhiHandlooms vendor account to manage products, orders, and earnings from your vendor dashboard.',
  alternates: { canonical: '/vendor-login' },
};

export default function VendorLoginPage() {
  return (
    <div className="container-boutique max-w-xl py-14 sm:py-20">
      <nav className="mb-8 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-secondary">Home</Link>
        <span className="mx-1">/</span>
        <span>Vendor Login</span>
      </nav>

      <div className="rounded-lg border border-border/60 bg-gradient-to-br from-primary/5 to-secondary/5 p-8 text-center">
        <Store className="mx-auto h-9 w-9 text-primary" />
        <h1 className="mt-3 font-serif text-3xl font-bold text-primary">Vendor Login</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Vendors log in with the same account used to apply. Once logged in, you&apos;ll be
          taken straight to your vendor dashboard to manage products, orders, and earnings.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/login?next=/vendor/dashboard">
            <Button className="bg-primary">
              <LogIn className="mr-2 h-4 w-4" />
              Log In to Vendor Dashboard
            </Button>
          </Link>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Not a vendor yet?{' '}
          <Link href="/vendor-registration" className="underline hover:text-secondary">
            Register as a vendor
          </Link>
        </p>
      </div>
    </div>
  );
}
