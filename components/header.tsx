'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useMemo, useRef, useEffect, FormEvent } from 'react';
import { Search, ShoppingBag, Menu, User, Heart, ArrowLeft } from 'lucide-react';
import { useCart, useProducts } from '@/lib/cart-context';
import { useAuth } from '@/lib/auth-context';
import { getCheckoutReturnPath, isCheckoutReturnFromBuyNow, clearCheckoutReturnBuyNowFlag } from '@/lib/checkout-return';
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
  { href: '/shop?category=Silk+Sarees', label: 'Silk Sarees' },
  { href: '/shop?category=Lehenga', label: 'Lehenga' },
  { href: '/shop?category=Bridal', label: 'Bridal' },
  { href: '/shop?category=Kurti', label: 'Kurti' },
];

export default function Header() {
  const { count, setCartOpen, addItem, buyNowItem, clearBuyNow } = useCart();
  const { products } = useProducts();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);

  // On these sub-pages, mobile shows a back arrow (left of the logo)
  // instead of the hamburger menu — matches how shopping apps let you
  // step back to the previous screen instead of opening the full nav.
  const showBackButton =
    pathname === '/shop' ||
    pathname.startsWith('/cart') ||
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/product/');

  // Browser history depth isn't reliable enough to build a "one tap always
  // works" back button on — prefetching, redirects, and how a page was
  // first opened can all change how many entries are really on the stack,
  // which is what made this button sometimes need two taps. On /checkout
  // specifically, we instead use the exact page markCheckoutEntry()
  // recorded when the shopper navigated here (see lib/checkout-return.ts)
  // and push straight to it — no history stack involved, so it's always
  // exactly one tap. Everywhere else, native history.back() is still used
  // since next/navigation's router.back() can lag a tap behind its own
  // route cache.
  //
  // Buy Now is special: it's a single-item express checkout that never
  // touches the real cart. If the shopper backs out of it, we don't want
  // that item to just vanish — so we drop it into the real cart and pop
  // open the side cart drawer instead of silently landing back on the
  // product page with nothing to show for it.
  const handleBack = () => {
    if (pathname.startsWith('/checkout')) {
      const returnPath = getCheckoutReturnPath();
      if (isCheckoutReturnFromBuyNow() && buyNowItem) {
        addItem(buyNowItem.product, buyNowItem.size, buyNowItem.quantity);
        clearBuyNow();
        clearCheckoutReturnBuyNowFlag();
        router.push(returnPath || '/');
        setCartOpen(true);
        return;
      }
      if (returnPath) {
        router.push(returnPath);
        return;
      }
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    } else {
      router.back();
    }
  };

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

  const goToProduct = (slug: string) => {
    router.push(`/product/${slug}`);
    setQuery('');
    setSuggestOpen(false);
    setMobileOpen(false);
    setMobileSearchOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur-md">
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
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
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
                  className="font-serif text-2xl font-bold text-primary"
                >
                  Aruhi
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
                </form>
                <nav className="flex flex-col gap-1">
                  {navLinks.map((l) => (
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

          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="whitespace-nowrap font-serif text-lg font-bold tracking-tight text-primary sm:text-2xl">
              Aruhi
            </span>
            <span className="hidden text-xs font-medium uppercase tracking-[0.2em] text-secondary sm:inline">
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
                onFocus={() => setSuggestOpen(true)}
                className="border-border/60 bg-muted/40 pl-9"
              />
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
            onClick={() => setMobileSearchOpen((v) => !v)}
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
                className="border-border/60 bg-muted/40 pl-9"
              />
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
