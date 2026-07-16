'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, FormEvent } from 'react';
import { Search, ShoppingBag, Menu } from 'lucide-react';
import { useCart } from '@/lib/cart-context';
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
  { href: '/admin', label: 'Admin' },
];

export default function Header() {
  const { count, setCartOpen } = useCart();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/shop?q=${encodeURIComponent(query.trim())}`);
      setMobileOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="container-boutique flex h-16 items-center justify-between gap-4">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 bg-background">
            <div className="flex h-full flex-col gap-6 pt-8">
              <Link
                href="/"
                onClick={() => setMobileOpen(false)}
                className="font-serif text-2xl font-bold text-primary"
              >
                Saaj
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

        <Link href="/" className="flex items-center gap-2">
          <span className="font-serif text-2xl font-bold tracking-tight text-primary">
            Saaj
          </span>
          <span className="hidden text-xs font-medium uppercase tracking-[0.2em] text-secondary sm:inline">
            Boutique
          </span>
        </Link>

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

        <form onSubmit={onSearch} className="hidden flex-1 max-w-xs items-center md:flex">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search sarees, lehenga, kurti..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="border-border/60 bg-muted/40 pl-9"
            />
          </div>
        </form>

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
    </header>
  );
}
