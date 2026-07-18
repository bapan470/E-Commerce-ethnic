'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Sparkles, Truck, ShieldCheck, Heart } from 'lucide-react';
import { useProducts } from '@/lib/cart-context';
import ProductCard from '@/components/product-card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function HomeClient() {
  const { products, categories, loading } = useProducts();
  const featured = products.filter((p) => p.featured).slice(0, 8);
  const newArrivals = products.slice(0, 4);

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/80">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-secondary/40 blur-3xl" />
          <div className="absolute right-0 top-40 h-80 w-80 rounded-full bg-secondary/30 blur-3xl" />
        </div>
        <div className="container-boutique relative grid items-center gap-8 py-16 md:grid-cols-2 md:py-24">
          <div className="flex flex-col gap-6 text-primary-foreground animate-fade-in">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-secondary/20 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-secondary">
              <Sparkles className="h-3.5 w-3.5" /> Handwoven Heritage
            </span>
            <h1 className="font-serif text-4xl font-bold leading-tight text-balance sm:text-5xl lg:text-6xl">
              Drape Yourself in Stories Woven by Hand
            </h1>
            <p className="max-w-md text-base text-primary-foreground/80 sm:text-lg">
              Discover handpicked sarees, lehengas and ethnic wear from master
              weavers across India. Timeless craftsmanship, modern convenience.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
              >
                <Link href="/shop" className="gap-2">
                  Shop Collection <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
              >
                <Link href="/shop?category=Bridal">Explore Bridal</Link>
              </Button>
            </div>
            <div className="mt-2 flex items-center gap-6 text-xs text-primary-foreground/70">
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-secondary" /> Authentic weaves</span>
              <span className="flex items-center gap-1.5"><Truck className="h-4 w-4 text-secondary" /> Free shipping over ₹2,000</span>
            </div>
          </div>
          <div className="relative hidden md:block">
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-secondary/30 shadow-2xl">
              <Image
                src="https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?auto=compress&cs=tinysrgb&w=900&h=1125&fit=crop"
                alt="Model wearing a handwoven embroidered Banarasi silk saree from Saaj Boutique"
                fill
                priority
                sizes="(max-width: 768px) 0px, 50vw"
                className="object-cover"
              />
              <div className="absolute bottom-4 left-4 right-4 rounded-xl bg-background/90 p-4 backdrop-blur-sm">
                <p className="font-serif text-sm font-semibold text-primary">
                  Banarasi Crimson Bridal
                </p>
                <p className="text-xs text-muted-foreground">
                  Katan silk · Varanasi
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-b border-border/60 bg-card">
        <div className="container-boutique grid gap-4 py-6 sm:grid-cols-3">
          {[
            { icon: ShieldCheck, title: 'Authentic Handloom', desc: 'Certified by Silk Mark' },
            { icon: Truck, title: 'Free Shipping', desc: 'On orders above ₹2,000' },
            { icon: Heart, title: 'Crafted with Care', desc: 'By master weavers' },
          ].map((f) => (
            <div key={f.title} className="flex items-center gap-3">
              <div className="rounded-full bg-accent p-2.5">
                <f.icon className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold">{f.title}</p>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="container-boutique py-14">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
              Curated Collections
            </p>
            <h2 className="mt-1 font-serif text-3xl font-bold text-primary">
              Shop by Category
            </h2>
          </div>
          <Link
            href="/shop"
            className="hidden items-center gap-1 text-sm font-medium text-primary hover:underline sm:flex"
          >
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[3/4] rounded-lg" />
              ))
            : categories.map((c) => (
                <Link
                  key={c.id}
                  href={`/shop?category=${encodeURIComponent(c.name)}`}
                  className="group relative aspect-[3/4] overflow-hidden rounded-lg border border-border/60"
                >
                  <Image
                    src="https://images.pexels.com/photos/1191349/pexels-photo-1191349.jpeg?auto=compress&cs=tinysrgb&w=600&h=700&fit=crop"
                    alt={`${c.name} - handwoven Indian ethnic wear collection at Saaj Boutique`}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3 text-primary-foreground">
                    <p className="font-serif text-sm font-semibold leading-tight">
                      {c.name}
                    </p>
                  </div>
                </Link>
              ))}
        </div>
      </section>

      {/* Featured */}
      <section className="bg-muted/40 py-14">
        <div className="container-boutique">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
                Editor’s Picks
              </p>
              <h2 className="mt-1 font-serif text-3xl font-bold text-primary">
                Featured Pieces
              </h2>
            </div>
            <Link
              href="/shop"
              className="hidden items-center gap-1 text-sm font-medium text-primary hover:underline sm:flex"
            >
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[4/5] rounded-lg" />
                ))
              : featured.map((p, idx) => (
                  <ProductCard key={p.id} product={p} priority={idx < 4} />
                ))}
          </div>
        </div>
      </section>

      {/* Banner */}
      <section className="container-boutique py-14">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-primary/80 px-8 py-12 text-primary-foreground sm:px-12">
          <div className="absolute -right-10 top-0 h-40 w-40 rounded-full bg-secondary/30 blur-3xl" />
          <div className="relative max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
              Bridal Edit
            </p>
            <h2 className="mt-2 font-serif text-3xl font-bold sm:text-4xl">
              Your Wedding, Woven in Gold
            </h2>
            <p className="mt-3 text-primary-foreground/80">
              Heirloom Banarasi and velvet lehengas, hand-embroidered for the day
              you’ll remember forever.
            </p>
            <Button
              asChild
              className="mt-5 bg-secondary text-secondary-foreground hover:bg-secondary/90"
            >
              <Link href="/shop?category=Bridal" className="gap-2">
                Explore Bridal <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* New arrivals */}
      <section className="container-boutique pb-16">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
              Just In
            </p>
            <h2 className="mt-1 font-serif text-3xl font-bold text-primary">
              New Arrivals
            </h2>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[4/5] rounded-lg" />
              ))
            : newArrivals.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
        </div>
      </section>
    </div>
  );
}
