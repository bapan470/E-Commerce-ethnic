'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Sparkles, Truck, ShieldCheck } from 'lucide-react';
import { useProducts } from '@/lib/cart-context';
import { fetchSiteBanner, SiteBanner } from '@/lib/settings-api';
import { fetchPublicCollections, PublicCollectionRow } from '@/lib/admin-collections-api';
import ProductCard from '@/components/product-card';
import CouponStrip from '@/components/home/coupon-strip';
import PromoSlider from '@/components/home/promo-slider';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function HomeClient() {
  const { products, categories, loading } = useProducts();
  const featured = products.filter((p) => p.featured).slice(0, 8);
  const newArrivals = products.slice(0, 4);

  // Admin > Settings > Store Banner — same image shown storewide, but on
  // the homepage it takes over the hero slot entirely (like a clearance
  // banner) instead of stacking on top of the marketing copy below. Falls
  // back to the default hero until the admin uploads one.
  const [banner, setBanner] = useState<SiteBanner | null>(null);
  useEffect(() => {
    fetchSiteBanner()
      .then((b) => setBanner(b.image_url ? b : null))
      .catch(() => setBanner(null));
  }, []);

  // Admin > Collections — curated groupings (e.g. "Diwali Specials"),
  // shown here the same way categories are: a row of clickable circles
  // that link through to /collection/[slug]. Only ever contains active
  // collections that already have at least one live product (enforced
  // server-side in /api/collections), so an empty or draft collection
  // never shows up on the storefront.
  const [collections, setCollections] = useState<PublicCollectionRow[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  useEffect(() => {
    fetchPublicCollections()
      .then(setCollections)
      .catch(() => setCollections([]))
      .finally(() => setCollectionsLoading(false));
  }, []);

  // Each category row's circle is pulled live from that category's own
  // products — the admin's Featured pick first, else just the newest —
  // so adding/removing/replacing products updates these automatically.
  const categoryThumbs = useMemo(() => {
    const map = new Map<string, string | undefined>();
    for (const c of categories) {
      const inCat = products.filter((p) => p.category === c.name);
      const best = inCat.find((p) => p.featured) || inCat[0];
      map.set(c.id, best?.images?.[0]);
    }
    return map;
  }, [categories, products]);

  // How many live products sit in each category — used to hide any
  // category that currently has zero products from "Shop by Category"
  // so shoppers never land on an empty grid.
  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of categories) {
      map.set(c.id, products.filter((p) => p.category === c.name).length);
    }
    return map;
  }, [categories, products]);

  const visibleCategories = useMemo(
    () => categories.filter((c) => (categoryCounts.get(c.id) ?? 0) > 0),
    [categories, categoryCounts]
  );

  return (
    <div className="flex flex-col">
      {/* Hero */}
      {banner ? (
        <section className="w-full">
          {banner.link_url ? (
            <Link href={banner.link_url} className="relative block aspect-[4/5] w-full sm:aspect-[16/6]">
              <Image
                src={banner.image_url}
                alt="Current promotion"
                fill
                priority
                sizes="100vw"
                className="object-cover"
              />
            </Link>
          ) : (
            <div className="relative aspect-[4/5] w-full sm:aspect-[16/6]">
              <Image
                src={banner.image_url}
                alt="Current promotion"
                fill
                priority
                sizes="100vw"
                className="object-cover"
              />
            </div>
          )}
        </section>
      ) : (
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/80">
        <div className="absolute inset-0 opacity-20">
          <div className="animate-float absolute -left-20 top-10 h-72 w-72 rounded-full bg-secondary/40 blur-3xl" />
          <div
            className="animate-float absolute right-0 top-40 h-80 w-80 rounded-full bg-secondary/30 blur-3xl"
            style={{ animationDelay: '1.5s' }}
          />
        </div>
        <div className="container-boutique relative grid items-center gap-6 py-8 pb-6 sm:gap-8 sm:py-12 sm:pb-10 md:grid-cols-2 md:py-24">
          <div className="flex flex-col gap-5 text-primary-foreground sm:gap-6">
            <span
              className="animate-fade-in inline-flex w-fit items-center gap-2 rounded-full bg-secondary/20 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-secondary"
              style={{ animationDelay: '0ms' }}
            >
              <Sparkles className="h-3.5 w-3.5" /> Handwoven Heritage
            </span>
            <h1
              className="animate-fade-in font-serif text-3xl font-bold leading-tight text-balance sm:text-5xl lg:text-6xl"
              style={{ animationDelay: '100ms' }}
            >
              Drape Yourself in Stories Woven by Hand
            </h1>
            <p
              className="animate-fade-in max-w-md text-sm text-primary-foreground/80 sm:text-lg"
              style={{ animationDelay: '200ms' }}
            >
              Discover handpicked sarees, lehengas and ethnic wear from master
              weavers across India. Timeless craftsmanship, modern convenience.
            </p>
            <div
              className="animate-fade-in flex flex-col gap-3 sm:flex-row sm:flex-wrap"
              style={{ animationDelay: '300ms' }}
            >
              <Button
                asChild
                size="lg"
                className="w-full justify-center bg-secondary text-secondary-foreground shadow-lg shadow-secondary/20 transition-all duration-300 hover:scale-[1.02] hover:bg-secondary/90 hover:shadow-xl hover:shadow-secondary/30 sm:w-auto"
              >
                <Link href="/shop" className="gap-2">
                  Shop Collection <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="w-full justify-center border-primary-foreground/30 bg-transparent text-primary-foreground transition-all duration-300 hover:scale-[1.02] hover:bg-primary-foreground/10 sm:w-auto"
              >
                <Link href="/shop?category=Bridal">Explore Bridal</Link>
              </Button>
            </div>
            <div
              className="animate-fade-in mt-1 flex items-center gap-6 text-xs text-primary-foreground/70"
              style={{ animationDelay: '400ms' }}
            >
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-secondary" /> Authentic weaves</span>
              <span className="flex items-center gap-1.5"><Truck className="h-4 w-4 text-secondary" /> Free shipping over ₹2,000</span>
            </div>
          </div>
          <div className="relative hidden md:block">
            <div className="animate-scale-in relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-secondary/30 shadow-2xl" style={{ animationDelay: '150ms' }}>
              <Image
                src="https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?auto=compress&cs=tinysrgb&w=900&h=1125&fit=crop"
                alt="Model wearing a handwoven embroidered Banarasi silk saree from Aruhi Handlooms"
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
      )}

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
        <div className="grid grid-cols-4 gap-x-3 gap-y-6 sm:grid-cols-6 lg:grid-cols-8">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <Skeleton className="h-16 w-16 rounded-full sm:h-20 sm:w-20" />
                  <Skeleton className="h-3 w-12 rounded" />
                </div>
              ))
            : visibleCategories.map((c) => {
                const thumb = categoryThumbs.get(c.id);
                return (
                  <Link
                    key={c.id}
                    href={`/shop?category=${encodeURIComponent(c.name)}`}
                    className="group flex flex-col items-center gap-2 text-center"
                  >
                    <div className="relative h-16 w-16 overflow-hidden rounded-full border border-border/60 bg-muted shadow-sm transition-transform duration-300 group-hover:scale-105 sm:h-20 sm:w-20">
                      {thumb ? (
                        <Image
                          src={thumb}
                          alt={`${c.name} - handwoven Indian ethnic wear collection at Aruhi Handlooms`}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                          {c.name.slice(0, 1)}
                        </div>
                      )}
                    </div>
                    <p className="line-clamp-2 font-serif text-xs font-semibold leading-tight text-foreground sm:text-sm">
                      {c.name}
                    </p>
                  </Link>
                );
              })}
          {!loading && visibleCategories.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground">
              New categories are on their way — check back soon.
            </p>
          )}
        </div>
      </section>

      {/* Collections — same circle-row treatment as categories above, but
          sourced from Admin > Collections instead of the categories table.
          Hidden entirely once collectionsLoading finishes if there are no
          active collections with products yet, so it never leaves an odd
          empty gap on a fresh store. */}
      {(collectionsLoading || collections.length > 0) && (
        <section className="container-boutique pb-14">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
                Handpicked For You
              </p>
              <h2 className="mt-1 font-serif text-3xl font-bold text-primary">
                Shop by Collection
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-x-3 gap-y-6 sm:grid-cols-6 lg:grid-cols-8">
            {collectionsLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <Skeleton className="h-16 w-16 rounded-full sm:h-20 sm:w-20" />
                    <Skeleton className="h-3 w-12 rounded" />
                  </div>
                ))
              : collections.map((c) => (
                  <Link
                    key={c.id}
                    href={`/collection/${c.slug}`}
                    className="group flex flex-col items-center gap-2 text-center"
                  >
                    <div className="relative h-16 w-16 overflow-hidden rounded-full border border-border/60 bg-muted shadow-sm transition-transform duration-300 group-hover:scale-105 sm:h-20 sm:w-20">
                      {c.thumbnail ? (
                        <Image
                          src={c.thumbnail}
                          alt={`${c.name} - curated collection at Aruhi Handlooms`}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                          {c.name.slice(0, 1)}
                        </div>
                      )}
                    </div>
                    <p className="line-clamp-2 font-serif text-xs font-semibold leading-tight text-foreground sm:text-sm">
                      {c.name}
                    </p>
                  </Link>
                ))}
          </div>
        </section>
      )}

      <PromoSlider />

      <CouponStrip />

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
