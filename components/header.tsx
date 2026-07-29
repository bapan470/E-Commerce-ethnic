'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useMemo, useRef, useEffect, useCallback, FormEvent } from 'react';
import { Search, ShoppingBag, Menu, User, Heart, ArrowLeft, Camera, Loader2 } from 'lucide-react';
import { useCart, useCategories } from '@/lib/cart-context';
import { useAuth } from '@/lib/auth-context';
import { getCheckoutReturnPath, isCheckoutReturnFromBuyNow, clearCheckoutReturnBuyNowFlag } from '@/lib/checkout-return';
import { rankProductIdsByImage } from '@/lib/image-search';
import { fetchProducts } from '@/lib/products-api';
import { Product } from '@/lib/types';
import { formatINR } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';

const navLinks = [
  { href: '/shop', label: 'Shop All' },
  { href: '/category/silk-sarees', label: 'Silk Sarees' },
  { href: '/category/cotton-silk', label: 'Cotton Silk' },
  { href: '/category/cotton-blend', label: 'Cotton Blend' },
  { href: '/category/mulmul-cotton-saree', label: 'Mulmul Cotton' },
  { href: '/blog', label: 'Blog' },
];

export default function Header() {
  const { count, setCartOpen, addItem, buyNowItem, clearBuyNow } = useCart();
  const { categories } = useCategories();
  const { user } = useAuth();
  // Header renders on every page, so it can't sit behind the heavy
  // ProductsProvider (root layout only carries the light Categories/
  // PaymentDiscount providers now). Products are only needed for search
  // suggestions, the mobile menu's category list, and image search — all
  // things the shopper opts into — so we fetch the catalog lazily, once,
  // the first time any of those is used, instead of on every page load.
  const [products, setProducts] = useState<Product[]>([]);
  const productsLoadedRef = useRef(false);
  const productsPromiseRef = useRef<Promise<Product[]> | null>(null);

  const ensureProductsLoaded = useCallback((): Promise<Product[]> => {
    if (productsLoadedRef.current) return Promise.resolve(products);
    if (productsPromiseRef.current) return productsPromiseRef.current;
    const promise = fetchProducts()
      .then((prods) => {
        productsLoadedRef.current = true;
        setProducts(prods);
        return prods;
      })
      .catch(() => [] as Product[])
      .finally(() => {
        productsPromiseRef.current = null;
      });
    productsPromiseRef.current = promise;
    return promise;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageSearching, setImageSearching] = useState(false);

  // On these sub-pages, mobile shows a back arrow (left of the logo)
  // instead of the hamburger menu — matches how shopping apps let you
  // step back to the previous screen instead of opening the full nav.
  // Mobile menu shows every category that actually has at least one
  // product (unlike the desktop nav, which keeps a fixed shortlist),
  // plus links to account management, reseller sign-up, and contact us.
  const mobileNavLinks = useMemo(() => {
    const namesWithProducts = new Set(products.map((p) => p.category));
    const categoryLinks = categories
      .filter((c) => namesWithProducts.has(c.name))
      .map((c) => ({
        href: `/category/${c.slug}`,
        label: c.name,
      }));

    return [
      { href: '/shop', label: 'Shop All' },
      ...categoryLinks,
      { href: '/blog', label: 'Blog' },
      { href: '/account', label: 'My Account' },
      { href: '/account/reseller', label: 'Reseller' },
      { href: '/contact', label: 'Contact Us' },
    ];
  }, [products, categories]);

  const showBackButton =
    pathname === '/shop' ||
    pathname.startsWith('/cart') ||
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/product/');

  // Browser history depth isn't reliable enough to build a "one tap always
  // works" back button on — prefetching, redirects, colour-swatch URL swaps
  // (see handleSelectVariant in product-detail.tsx, which updates the URL
  // with a raw history.replaceState so switching colour never reloads the
  // page) can all leave Next.js's own idea of "current route" out of sync
  // with the real browser history stack. That mismatch is what made native
  // back (hardware back button, edge-swipe gesture, or the browser's own
  // back button) sometimes need two taps to actually leave /checkout —
  // especially on a colour-variant page. So on /checkout specifically, we
  // don't trust history depth at all: we use the exact page
  // markCheckoutEntry() recorded when the shopper navigated here (see
  // lib/checkout-return.ts) and push straight to it.
  //
  // Buy Now is special: it's a single-item express checkout that never
  // touches the real cart. If the shopper backs out of it (by any method),
  // we don't want that item to just vanish, so we drop it into the real
  // cart — but we don't force the side cart drawer open; the shopper just
  // lands back on the page they were on, same as any other back nav.
  const recoverFromCheckout = (returnPath: string | null) => {
    if (isCheckoutReturnFromBuyNow()) {
      if (buyNowItem) {
        addItem(buyNowItem.product, buyNowItem.size, buyNowItem.quantity, { silent: true });
      }
      clearBuyNow();
      clearCheckoutReturnBuyNowFlag();
    }
    return returnPath;
  };

  const handleBack = () => {
    if (pathname.startsWith('/checkout')) {
      // /checkout is always entered via router.push (Buy Now, cart drawer,
      // cart page), so the page we want is already one step back in real
      // browser history — a native back cleanly consumes that pushed
      // /checkout entry and lands exactly there, with no duplicate entries.
      // The pathname-watcher effect below silently corrects the landing
      // spot (via replace, never push) if native back ever lands somewhere
      // other than what markCheckoutEntry recorded, so this stays reliable
      // even when history doesn't behave as expected.
      recoverFromCheckout(getCheckoutReturnPath());
      if (typeof window !== 'undefined' && window.history.length > 1) {
        window.history.back();
      } else {
        router.replace(getCheckoutReturnPath() || '/');
      }
      return;
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    } else {
      router.back();
    }
  };

  // Tapping our own arrow above is one way off /checkout — but the shopper
  // can just as easily leave it with the phone's hardware back button, an
  // edge-swipe gesture, or the browser's native back button. None of those
  // call handleBack, so without this they'd skip the Buy Now recovery above
  // and could land wherever the (unreliable) history stack happened to
  // point, which is exactly the "needs two taps" bug. This watches for the
  // route actually changing away from /checkout — however it happened —
  // and replays the same recovery, correcting the landing page to the
  // exact page markCheckoutEntry() recorded if native back didn't land
  // there itself.
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    const wasOnCheckout = pathnameRef.current?.startsWith('/checkout');
    const nowOnCheckout = pathname.startsWith('/checkout');
    // /login and /signup are intentional detours from checkout (e.g. the
    // resell-login prompt sends the shopper there with ?next=/checkout) —
    // they bring the shopper straight back to /checkout once they're done,
    // so this recovery logic must not treat that as a "left checkout" event
    // and bounce them to wherever they were before checkout instead.
    const nowOnAuthDetour = pathname === '/login' || pathname === '/signup';
    // A successful order sends the shopper from /checkout to
    // /order-confirmation/[id] — that's a real, intentional destination,
    // not an accidental "left checkout" navigation, so it must never be
    // treated as one or the Thank You page gets bounced back instantly.
    const nowOnOrderConfirmation = pathname.startsWith('/order-confirmation');
    if (wasOnCheckout && !nowOnCheckout && !nowOnAuthDetour && !nowOnOrderConfirmation) {
      const returnPath = recoverFromCheckout(getCheckoutReturnPath());
      if (returnPath && returnPath !== pathname + window.location.search) {
        router.replace(returnPath);
      }
    }
    pathnameRef.current = pathname;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.fabric.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [query, products]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setSuggestOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (mobileSearchOpen) {
      mobileSearchInputRef.current?.focus();
    }
  }, [mobileSearchOpen]);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/shop?q=${encodeURIComponent(query.trim())}`);
      setMobileOpen(false);
      setSuggestOpen(false);
      setMobileSearchOpen(false);
    }
  };

  // "Search by image": shopper taps the camera icon, picks a photo, and we
  // rank the whole catalog by visual similarity, then hand the ranked id
  // list to /shop via sessionStorage — same pattern as the text search's
  // `?q=` but there's no clean way to put an uploaded photo in a URL, so
  // sessionStorage is the handoff instead.
  //
  // Two ranking methods, tried in order:
  //  1. AI (app/api/image-search) — the real NVIDIA vision model reads the
  //     photo (garment type/colour/pattern) and ranks the catalog against
  //     that. Only used if the admin has turned it on in Settings AND
  //     NVIDIA_API_KEY is configured; the route itself reports back which
  //     of those wasn't true via `reason` so this never just hangs.
  //  2. Colour-fingerprint match (lib/image-search.ts) — free, instant,
  //     fully client-side. Always available as the fallback, so the
  //     feature keeps working even with AI off or the free NVIDIA tier
  //     rate-limited.
  const triggerImageSearch = () => {
    if (imageSearching) return;
    // Kick off the product fetch as early as possible — the file picker
    // (imageInputRef.current?.click()) hands control to the OS/browser UI
    // while the shopper picks a photo, which gives this a head start so the
    // catalog is often already loaded by the time handleImageFileChange
    // needs it.
    ensureProductsLoaded();
    imageInputRef.current?.click();
  };

  const tryAiImageSearch = async (currentProducts: Product[], dataUrl: string): Promise<string[] | null> => {
    try {
      const liteProducts = currentProducts.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        colors: p.all_colors && p.all_colors.length > 0 ? p.all_colors : p.colors,
        pattern: p.pattern,
        occasion: p.occasion,
        fabric: p.fabric,
      }));

      const res = await fetch('/api/image-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl, products: liteProducts }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data?.ok) return null; // disabled / not configured / rate-limited / error — caller falls back
      return Array.isArray(data.rankedIds) ? data.rankedIds : null;
    } catch {
      return null; // network hiccup — caller falls back
    }
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImageSearching(true);
    setSuggestOpen(false);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('read failed'));
        reader.readAsDataURL(file);
      });

      // Don't rely on the `products` state closure here — it may still be
      // empty if this fires before the lazy fetch (started in
      // triggerImageSearch) has resolved. Awaiting the same in-flight
      // promise guarantees whichever caller gets here first, everyone
      // resolves against the same up-to-date catalog.
      const currentProducts = await ensureProductsLoaded();

      let rankedIds = await tryAiImageSearch(currentProducts, dataUrl);
      // Fall back to the client-side colour match whenever AI didn't give
      // us a usable, non-empty result — not just when it returned null.
      // Previously an AI response of `rankedIds: []` (photo understood,
      // but nothing scored) was treated as final and skipped the fallback
      // entirely, so the shopper saw "couldn't match" even though the
      // colour-fingerprint method might have found something.
      if (!rankedIds || rankedIds.length === 0) {
        rankedIds = await rankProductIdsByImage(currentProducts, dataUrl);
      }

      if (rankedIds.length === 0) {
        window.alert("Couldn't match that photo to any products — try a clearer photo of the item.");
        return;
      }
      sessionStorage.setItem('imageSearchResults', JSON.stringify(rankedIds));
      setMobileOpen(false);
      setMobileSearchOpen(false);
      router.push('/shop?imgsearch=1');
    } catch {
      window.alert('Something went wrong reading that photo. Please try another image.');
    } finally {
      setImageSearching(false);
    }
  };

  const goToProduct = (slug: string) => {
    router.push(`/product/${slug}`);
    setQuery('');
    setSuggestOpen(false);
    setMobileOpen(false);
    setMobileSearchOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur-md">
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFileChange}
      />
      <div className="container-boutique flex h-12 items-center justify-between gap-2 sm:gap-4">
        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          {showBackButton ? (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 md:hidden"
              aria-label="Go back"
              onClick={handleBack}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          ) : (
          <Sheet
            open={mobileOpen}
            onOpenChange={(open) => {
              setMobileOpen(open);
              if (open) ensureProductsLoaded();
            }}
          >
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 md:hidden" aria-label="Menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-72 bg-background"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <div className="flex h-full flex-col gap-6 pt-8">
                <Link
                  href="/"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-0"
                >
                  <span className="font-serif text-2xl font-bold text-primary">Aruhi</span>
                  <span className="font-serif text-2xl font-bold text-secondary">
                    Handlooms
                  </span>
                </Link>
                <form onSubmit={onSearch} className="flex gap-2">
                  <Input
                    placeholder="Search sarees..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="bg-muted"
                  />
                  <Button type="submit" size="icon" aria-label="Search">
                    <Search className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    aria-label="Search by image"
                    onClick={triggerImageSearch}
                    disabled={imageSearching}
                  >
                    {imageSearching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                  </Button>
                </form>
                <nav className="flex flex-col gap-1">
                  {mobileNavLinks.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={() => setMobileOpen(false)}
                      className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      {l.label}
                    </Link>
                  ))}
                </nav>
              </div>
            </SheetContent>
          </Sheet>
          )}

          <Link href="/" className="flex shrink-0 items-center gap-0">
            <span className="whitespace-nowrap font-serif text-lg font-bold tracking-tight text-primary sm:text-2xl">
              Aruhi
            </span>
            <span className="whitespace-nowrap font-serif text-lg font-bold tracking-tight text-secondary sm:text-2xl">
              Handlooms
            </span>
          </Link>
        </div>

        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-foreground/80 transition-colors hover:text-primary"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div ref={searchWrapRef} className="relative hidden flex-1 max-w-xs md:block">
          <form onSubmit={onSearch} className="flex items-center">
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search sarees, lehenga, kurti..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => {
                  setSuggestOpen(true);
                  ensureProductsLoaded();
                }}
                className="border-border/60 bg-muted/40 pl-9 pr-9"
              />
              <button
                type="button"
                onClick={triggerImageSearch}
                disabled={imageSearching}
                aria-label="Search by image"
                title="Search by image"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-primary disabled:opacity-50"
              >
                {imageSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </button>
            </div>
          </form>

          {suggestOpen && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-lg border border-border/60 bg-background shadow-lg">
              {suggestions.map((p) => (
                <button
                  key={p.id}
                  onClick={() => goToProduct(p.slug)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/60"
                >
                  <div className="relative h-11 w-9 shrink-0 overflow-hidden rounded bg-muted">
                    {p.images[0] && (
                      <Image src={p.images[0]} alt={p.name} fill sizes="36px" className="object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.category}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-primary">
                    {formatINR(p.price)}
                  </span>
                </button>
              ))}
              <button
                onClick={onSearch as any}
                className="w-full border-t border-border/60 px-3 py-2 text-center text-xs font-medium text-primary hover:bg-muted/60"
              >
                See all results for &quot;{query}&quot;
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setMobileSearchOpen((v) => !v);
              ensureProductsLoaded();
            }}
            className="md:hidden"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </Button>

          <Button variant="ghost" size="icon" asChild className="hidden sm:inline-flex" aria-label="Wishlist">
            <Link href="/account/wishlist">
              <Heart className="h-5 w-5" />
            </Link>
          </Button>

          <Button variant="ghost" size="icon" asChild aria-label={user ? 'My account' : 'Login'}>
            <Link href={user ? '/account/orders' : '/login'}>
              <User className="h-5 w-5" />
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCartOpen(true)}
            aria-label="Open cart"
            className="relative"
          >
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-secondary px-1 text-xs font-bold text-secondary-foreground">
                {count}
              </span>
            )}
          </Button>
        </div>
      </div>

      {mobileSearchOpen && (
        <div className="border-t border-border/60 bg-background md:hidden">
          <div className="container-boutique py-3">
            <form onSubmit={onSearch} className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={mobileSearchInputRef}
                placeholder="Search sarees, lehenga, kurti..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="border-border/60 bg-muted/40 pl-9 pr-9"
              />
              <button
                type="button"
                onClick={triggerImageSearch}
                disabled={imageSearching}
                aria-label="Search by image"
                title="Search by image"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-primary disabled:opacity-50"
              >
                {imageSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </button>
            </form>

            {suggestions.length > 0 && (
              <div className="mt-2 max-h-80 overflow-y-auto rounded-lg border border-border/60">
                {suggestions.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => goToProduct(p.slug)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/60"
                  >
                    <div className="relative h-11 w-9 shrink-0 overflow-hidden rounded bg-muted">
                      {p.images[0] && (
                        <Image src={p.images[0]} alt={p.name} fill sizes="36px" className="object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.category}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-primary">
                      {formatINR(p.price)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
