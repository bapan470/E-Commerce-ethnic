import Link from 'next/link';
import type { Metadata } from 'next';
import {
  MapPin,
  Mail,
  Phone,
  ShieldCheck,
  Hand,
  Leaf,
  Gem,
  Truck,
  Feather,
  ScanSearch,
  PackageCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getServerSupabase } from '@/lib/supabase-server';
import { safeJsonLd } from '@/lib/json-ld';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'About Us',
  description:
    'AruhiHandlooms sources and sells handwoven ethnic wear directly from weaving clusters across India — who we are, how we work, and how to reach us.',
  alternates: { canonical: '/about' },
};

async function getStoreInfo() {
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'store_info')
    .maybeSingle();
  return (data?.value as any) || {};
}

const values = [
  {
    icon: Hand,
    title: 'Handwoven, not mass-produced',
    body: 'Every saree and set is woven on a loom by hand. Small irregularities in weave and color are marks of handwork, not defects.',
  },
  {
    icon: Gem,
    title: 'Sourced directly from weavers',
    body: 'We work with weaving clusters across India instead of routing through multiple middlemen, so quality and pricing stay traceable.',
  },
  {
    icon: Leaf,
    title: 'Natural fibres first',
    body: 'Silk, cotton, mulmul and cotton-silk blends are chosen for how they wear and drape, not just how they photograph.',
  },
  {
    icon: ShieldCheck,
    title: 'Accountable after the sale',
    body: 'Real order, shipping and refund policies apply to every purchase — see our support details below if anything needs sorting out.',
  },
];

const processSteps = [
  {
    icon: Feather,
    step: '01',
    title: 'Yarn & design',
    body: 'Yarn is selected and a weave design is set before a single thread goes on the loom.',
  },
  {
    icon: ScanSearch,
    step: '02',
    title: 'Handloom weaving',
    body: 'Artisans weave each piece by hand, which is why timelines vary and no two pieces are perfectly identical.',
  },
  {
    icon: PackageCheck,
    step: '03',
    title: 'Quality check',
    body: 'Every piece is checked for weave, finish and stitching before it is listed as ready to ship.',
  },
  {
    icon: Truck,
    step: '04',
    title: 'Packed & shipped',
    body: 'Orders are packed and handed to our courier partners with tracking shared on your account.',
  },
];

export default async function AboutPage() {
  const store = await getStoreInfo();

  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: store.name || 'AruhiHandlooms',
    url: process.env.NEXT_PUBLIC_SITE_URL || undefined,
    ...(store.address ? { address: store.address } : {}),
    ...(store.support_email ? { email: store.support_email } : {}),
    ...(store.support_phone ? { telephone: store.support_phone } : {}),
  };

  return (
    <div className="pb-16">
      {/* JSON-LD: Organization schema, driven by the same store_info the
          Contact page and Merchant Center feed use, so business identity
          stays consistent everywhere it's declared. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(orgJsonLd) }}
      />

      {/* Hero */}
      <div className="border-b border-border/60 bg-primary text-primary-foreground">
        <div className="container-boutique max-w-5xl py-14 sm:py-20">
          <nav className="mb-8 text-xs text-primary-foreground/70">
            <Link href="/" className="hover:text-secondary">Home</Link>
            <span className="mx-1">/</span>
            <span className="text-primary-foreground">About Us</span>
          </nav>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
            Our story
          </p>
          <h1 className="mt-3 max-w-2xl font-serif text-4xl font-bold leading-tight sm:text-5xl">
            Handwoven ethnic wear, sold the way it's made — by hand, and by name.
          </h1>
          <p className="mt-5 max-w-xl text-sm text-primary-foreground/80 sm:text-base">
            AruhiHandlooms sources sarees, lehengas and bridal wear directly from
            handloom weaving clusters across India, and sells them online with the
            same care they were woven with.
          </p>
        </div>
        <div className="gold-divider" />
      </div>

      {/* Story */}
      <div className="container-boutique max-w-3xl py-12 sm:py-16">
        <h2 className="font-serif text-2xl font-bold text-primary sm:text-3xl">
          Why we exist
        </h2>
        <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
          <p>
            Handloom weaving is slow, skilled work, and it rarely gets sold that way
            online — pieces pass through several hands before reaching a customer,
            with little said about who actually wove them. AruhiHandlooms was built
            to shorten that distance: we work with weavers directly, list what's
            actually in stock, and stand behind every order with a real support
            team and real policies.
          </p>
          <p>
            We're not a print-on-demand storefront or a drop-shipped catalogue.
            What you see listed is what our team has checked, photographed and
            can ship — and if something isn't right, our{' '}
            <Link href="/legal/refund-policy" className="text-primary underline underline-offset-2 hover:text-secondary">
              refund policy
            </Link>{' '}
            and{' '}
            <Link href="/contact" className="text-primary underline underline-offset-2 hover:text-secondary">
              support team
            </Link>{' '}
            are there to fix it.
          </p>
        </div>
      </div>

      {/* Values */}
      <div className="bg-muted/40 py-12 sm:py-16">
        <div className="container-boutique max-w-5xl">
          <h2 className="font-serif text-2xl font-bold text-primary sm:text-3xl">
            What we stand for
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {values.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-lg border border-border/60 bg-card p-6"
              >
                <span className="inline-flex rounded-full bg-primary/10 p-2.5 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-serif text-lg font-semibold text-foreground">
                  {title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Process */}
      <div className="container-boutique max-w-5xl py-12 sm:py-16">
        <h2 className="font-serif text-2xl font-bold text-primary sm:text-3xl">
          From loom to your door
        </h2>
        <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {processSteps.map(({ icon: Icon, step, title, body }, i) => (
            <div key={step} className="relative pl-1">
              <div className="flex items-center gap-3">
                <span className="font-serif text-2xl font-bold text-secondary/80">
                  {step}
                </span>
                <span className="rounded-full bg-primary/10 p-2 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-foreground">{title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
              {i < processSteps.length - 1 && (
                <div className="mt-6 hidden h-px w-full bg-border/60 lg:block" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Business identity / trust block */}
      <div className="border-t border-border/60 bg-primary/5">
        <div className="container-boutique max-w-5xl py-12 sm:py-16">
          <h2 className="font-serif text-2xl font-bold text-primary sm:text-3xl">
            Who you're buying from
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            In line with our{' '}
            <Link href="/legal/terms-conditions" className="text-primary underline underline-offset-2 hover:text-secondary">
              Terms &amp; Conditions
            </Link>{' '}
            and{' '}
            <Link href="/legal/privacy-policy" className="text-primary underline underline-offset-2 hover:text-secondary">
              Privacy Policy
            </Link>
            , here's how to verify or reach us directly.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {store.address && (
              <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-card p-5">
                <span className="rounded-full bg-primary/10 p-2 text-primary shrink-0">
                  <MapPin className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium">Registered address</p>
                  <p className="mt-1 text-sm text-muted-foreground">{store.address}</p>
                  {store.gstin && (
                    <p className="mt-1 text-xs text-muted-foreground">GSTIN: {store.gstin}</p>
                  )}
                </div>
              </div>
            )}
            {store.support_email && (
              <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-card p-5">
                <span className="rounded-full bg-primary/10 p-2 text-primary shrink-0">
                  <Mail className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <a
                    href={`mailto:${store.support_email}`}
                    className="mt-1 block text-sm text-muted-foreground hover:text-primary"
                  >
                    {store.support_email}
                  </a>
                </div>
              </div>
            )}
            {store.support_phone && (
              <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-card p-5">
                <span className="rounded-full bg-primary/10 p-2 text-primary shrink-0">
                  <Phone className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium">Phone</p>
                  <a
                    href={`tel:${store.support_phone}`}
                    className="mt-1 block text-sm text-muted-foreground hover:text-primary"
                  >
                    {store.support_phone}
                  </a>
                </div>
              </div>
            )}
          </div>

          {!store.address && !store.support_email && !store.support_phone && (
            <p className="mt-6 rounded-lg border border-dashed border-border/60 bg-card p-5 text-sm text-muted-foreground">
              Business address, GSTIN and support contact will appear here once
              added in Admin → Settings → Store Info.
            </p>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild className="bg-primary">
              <Link href="/shop">Shop the collection</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/contact">Contact us</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
