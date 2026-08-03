import Link from 'next/link';
import type { Metadata } from 'next';
import { CheckCircle2, Store, IndianRupee, Package, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { safeJsonLd } from '@/lib/json-ld';

// Public, crawlable landing page for the "reseller registration" search
// intent. The reseller program itself lives at /account/reseller, which
// requires login (middleware redirects logged-out visitors, including
// Googlebot, to /login before any content loads) — so it can't rank for
// this keyword on its own. This page gives Google real, indexable content
// to match the query, then funnels into login/join.
export const metadata: Metadata = {
  title: 'Reseller Registration — Become an AruhiHandlooms Reseller',
  description:
    'Register as a reseller with AruhiHandlooms. Set your own markup and resell handloom sarees and ethnic wear under your name — zero inventory required.',
  alternates: { canonical: '/reseller-registration' },
};

const steps = [
  {
    icon: Store,
    title: 'Create a free account',
    body: 'Sign up or log in with your existing AruhiHandlooms account — no separate reseller signup needed.',
  },
  {
    icon: TrendingUp,
    title: 'Join the reseller program',
    body: 'One click from your account to join — no application review, no waiting period.',
  },
  {
    icon: Package,
    title: 'Share products, zero inventory',
    body: 'Share our handloom catalog with your customers. We handle stock, packing, and shipping.',
  },
  {
    icon: IndianRupee,
    title: 'Set your markup, earn per order',
    body: 'Choose your own markup on top of our price and earn on every order placed through you.',
  },
];

const faqs = [
  {
    q: 'How do I register as a reseller on AruhiHandlooms?',
    a: 'Log in or create a free AruhiHandlooms account, then join the reseller program from your account page in a single click — there is no separate application form.',
  },
  {
    q: 'Is reseller registration free?',
    a: 'Yes, joining the reseller program is free and there is no inventory to buy upfront.',
  },
  {
    q: 'How much can I earn as a reseller?',
    a: 'You set your own markup amount on top of the base price. You earn that markup on every order placed through your reseller link.',
  },
];

export default function ResellerRegistrationPage() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <div className="pb-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }}
      />

      <div className="border-b border-border/60 bg-primary text-primary-foreground">
        <div className="container-boutique max-w-4xl py-14 sm:py-20">
          <nav className="mb-8 text-xs text-primary-foreground/70">
            <Link href="/" className="hover:text-secondary">Home</Link>
            <span className="mx-1">/</span>
            <span className="text-primary-foreground">Reseller Registration</span>
          </nav>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
            Become a Partner
          </p>
          <h1 className="mt-3 max-w-2xl font-serif text-4xl font-bold leading-tight sm:text-5xl">
            Reseller Registration
          </h1>
          <p className="mt-4 max-w-xl text-sm text-primary-foreground/80 sm:text-base">
            Start reselling and earn on every order. Set your own markup and sell our
            handloom collection under your name — zero inventory required.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/login?next=/account/reseller">
              <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                Start Reseller Registration
              </Button>
            </Link>
            <Link href="/reseller-login">
              <Button variant="outline" className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">
                Already a reseller? Log in
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container-boutique max-w-4xl py-12 sm:py-16">
        <h2 className="font-serif text-2xl font-bold text-primary sm:text-3xl">
          How reseller registration works
        </h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {steps.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-lg border border-border/60 bg-card p-5">
              <Icon className="h-6 w-6 text-secondary" />
              <p className="mt-3 font-serif text-lg font-semibold text-primary">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-14 font-serif text-2xl font-bold text-primary sm:text-3xl">
          Why resell with AruhiHandlooms
        </h2>
        <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
          {[
            'No upfront inventory — we hold and ship all stock',
            'Set and change your own markup any time',
            'Track orders and earnings from your reseller dashboard',
            'No separate signup — use your existing AruhiHandlooms account',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
              {item}
            </li>
          ))}
        </ul>

        <h2 className="mt-14 font-serif text-2xl font-bold text-primary sm:text-3xl">
          Frequently asked questions
        </h2>
        <div className="mt-6 space-y-6">
          {faqs.map((f) => (
            <div key={f.q}>
              <p className="font-semibold text-primary">{f.q}</p>
              <p className="mt-1 text-sm text-muted-foreground">{f.a}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 rounded-lg border border-border/60 bg-gradient-to-br from-primary/5 to-secondary/5 p-8 text-center">
          <p className="font-serif text-xl font-semibold text-primary">Ready to start reselling?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Join the program in a single click from your account.
          </p>
          <Link href="/login?next=/account/reseller">
            <Button className="mt-5 bg-primary">Start Reseller Registration</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
