import Link from 'next/link';
import type { Metadata } from 'next';
import { CheckCircle2, Store, Truck, IndianRupee, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { safeJsonLd } from '@/lib/json-ld';

// Public, crawlable landing page for the "vendor registration" search
// intent. The actual application form lives at /sell-with-us (which is
// itself public, but was previously untitled/undescribed for SEO purposes).
// This page exists so Google has a clear, keyword-matched result to show
// for "aruhi handloom vendor registration" style queries, and funnels
// straight into the real form.
export const metadata: Metadata = {
  title: 'Vendor Registration — Become a Supplying Vendor',
  description:
    'Register as a vendor with AruhiHandlooms and supply handloom sarees, lehengas and ethnic wear. Free registration, simple application, PAN/GST onboarding.',
  alternates: { canonical: '/vendor-registration' },
};

const steps = [
  {
    icon: Store,
    title: 'Apply online',
    body: 'Fill in your business details, PAN, and pickup address in a short form — takes under 5 minutes.',
  },
  {
    icon: ShieldCheck,
    title: 'Get verified',
    body: 'Our team reviews your application and KYC details, usually within a few business days.',
  },
  {
    icon: Truck,
    title: 'We handle logistics',
    body: 'Once approved, we photograph, list, and ship every order to the customer — you just supply stock.',
  },
  {
    icon: IndianRupee,
    title: 'Get paid',
    body: 'Track orders and settlements from your vendor dashboard after every fulfilled order.',
  },
];

const faqs = [
  {
    q: 'How do I register as a vendor on AruhiHandlooms?',
    a: 'Click "Start Vendor Registration" below, log in or create a free account, and submit the vendor application form with your business name, PAN, and pickup address.',
  },
  {
    q: 'Is there a fee for vendor registration?',
    a: 'No. Vendor registration and onboarding are free. You only need valid PAN details, and GST if applicable.',
  },
  {
    q: 'How do I log in after I become a vendor?',
    a: 'Approved vendors log in with the same account used to apply, via the vendor login page, and are taken straight to their vendor dashboard.',
  },
];

export default function VendorRegistrationPage() {
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
            <span className="text-primary-foreground">Vendor Registration</span>
          </nav>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
            Vendor Sourcing
          </p>
          <h1 className="mt-3 max-w-2xl font-serif text-4xl font-bold leading-tight sm:text-5xl">
            Vendor Registration
          </h1>
          <p className="mt-4 max-w-xl text-sm text-primary-foreground/80 sm:text-base">
            Supply handwoven sarees, lehengas, and ethnic wear to AruhiHandlooms. Register
            as a vendor, get verified, and let us handle photography, listing, and shipping
            for every order.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/sell-with-us">
              <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                Start Vendor Registration
              </Button>
            </Link>
            <Link href="/vendor-login">
              <Button variant="outline" className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">
                Already a vendor? Log in
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container-boutique max-w-4xl py-12 sm:py-16">
        <h2 className="font-serif text-2xl font-bold text-primary sm:text-3xl">
          How vendor registration works
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
          What you need to register
        </h2>
        <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
          {[
            'Business or owner name and phone number',
            'PAN number (GST optional, but recommended)',
            'A pickup address for courier collection',
            'A free AruhiHandlooms account to submit and track your application',
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
          <p className="font-serif text-xl font-semibold text-primary">Ready to register?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            It takes a few minutes to submit your vendor application.
          </p>
          <Link href="/sell-with-us">
            <Button className="mt-5 bg-primary">Start Vendor Registration</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
