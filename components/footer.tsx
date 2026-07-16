import Link from 'next/link';
import { Instagram, Facebook, Mail, Phone } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-border/60 bg-primary text-primary-foreground">
      <div className="container-boutique grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <h3 className="font-serif text-2xl font-bold text-secondary">Saaj</h3>
          <p className="mt-3 text-sm text-primary-foreground/80">
            Handwoven ethnic wear from master artisans across India. Crafted with
            love, delivered with care.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wider text-secondary">
            Shop
          </h4>
          <ul className="mt-3 space-y-2 text-sm text-primary-foreground/80">
            <li><Link href="/shop" className="hover:text-secondary">All Products</Link></li>
            <li><Link href="/shop?category=Silk+Sarees" className="hover:text-secondary">Silk Sarees</Link></li>
            <li><Link href="/shop?category=Lehenga" className="hover:text-secondary">Lehenga</Link></li>
            <li><Link href="/shop?category=Bridal" className="hover:text-secondary">Bridal</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wider text-secondary">
            Help
          </h4>
          <ul className="mt-3 space-y-2 text-sm text-primary-foreground/80">
            <li><Link href="/cart" className="hover:text-secondary">Cart</Link></li>
            <li><Link href="/checkout" className="hover:text-secondary">Checkout</Link></li>
            {/* Admin link intentionally omitted for security */}
            <li>Shipping & Returns</li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wider text-secondary">
            Connect
          </h4>
          <div className="mt-3 flex gap-3">
            <a href="#" aria-label="Instagram" className="rounded-full bg-primary-foreground/10 p-2 transition-colors hover:bg-secondary hover:text-secondary-foreground">
              <Instagram className="h-4 w-4" />
            </a>
            <a href="#" aria-label="Facebook" className="rounded-full bg-primary-foreground/10 p-2 transition-colors hover:bg-secondary hover:text-secondary-foreground">
              <Facebook className="h-4 w-4" />
            </a>
            <a href="mailto:hello@saaj.in" aria-label="Email" className="rounded-full bg-primary-foreground/10 p-2 transition-colors hover:bg-secondary hover:text-secondary-foreground">
              <Mail className="h-4 w-4" />
            </a>
            <a href="tel:+918001234567" aria-label="Phone" className="rounded-full bg-primary-foreground/10 p-2 transition-colors hover:bg-secondary hover:text-secondary-foreground">
              <Phone className="h-4 w-4" />
            </a>
          </div>
          <p className="mt-4 text-xs text-primary-foreground/70">
            +91 80012 34567<br />Mon–Sat, 10am–7pm IST
          </p>
        </div>
      </div>
      <div className="border-t border-primary-foreground/10 py-4">
        <div className="container-boutique flex flex-col items-center justify-between gap-2 text-xs text-primary-foreground/60 sm:flex-row">
          <p>© {new Date().getFullYear()} Saaj Boutique. All rights reserved.</p>
          <p>Crafted in India · Handloom certified</p>
        </div>
      </div>
    </footer>
  );
}
