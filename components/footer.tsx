'use client';

import Link from 'next/link';
import { Instagram, Facebook, Mail, Phone } from 'lucide-react';
import NewsletterSignup from './newsletter-signup';
import { useCart } from '@/lib/cart-context';

export default function Footer() {
  const { clearBuyNow } = useCart();
  return (
    <footer className="mt-16 border-t border-border/60 bg-primary text-primary-foreground">
      <div className="container-boutique grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <h3 className="font-serif text-2xl font-bold text-secondary">Aruhi Handlooms</h3>
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
            <li><Link href="/gift-cards" className="hover:text-secondary">Gift Cards</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wider text-secondary">
            Help
          </h4>
          <ul className="mt-3 space-y-2 text-sm text-primary-foreground/80">
            <li><Link href="/cart" className="hover:text-secondary">Cart</Link></li>
            <li><Link href="/checkout" onClick={() => clearBuyNow()} className="hover:text-secondary">Checkout</Link></li>
            <li><Link href="/contact" className="hover:text-secondary">Contact Us</Link></li>
            {/* Admin link intentionally omitted for security */}
            <li><Link href="/legal/shipping-policy" className="hover:text-secondary">Shipping & Returns</Link></li>
            <li><Link href="/legal/refund-policy" className="hover:text-secondary">Refund & Cancellation</Link></li>
            <li><Link href="/legal/privacy-policy" className="hover:text-secondary">Privacy Policy</Link></li>
            <li><Link href="/legal/terms-conditions" className="hover:text-secondary">Terms & Conditions</Link></li>
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
            <a href="mailto:hello@aruhihandlooms.com" aria-label="Email" className="rounded-full bg-primary-foreground/10 p-2 transition-colors hover:bg-secondary hover:text-secondary-foreground">
              <Mail className="h-4 w-4" />
            </a>
            <a href="tel:+918001234567" aria-label="Phone" className="rounded-full bg-primary-foreground/10 p-2 transition-colors hover:bg-secondary hover:text-secondary-foreground">
              <Phone className="h-4 w-4" />
            </a>
          </div>
          <p className="mt-4 text-xs text-primary-foreground/70">
            +91 80012 34567<br />Mon–Sat, 10am–7pm IST
          </p>
          <h4 className="mt-5 text-sm font-semibold uppercase tracking-wider text-secondary">
            Newsletter
          </h4>
          <p className="mt-2 text-xs text-primary-foreground/70">
            Get first access to new arrivals and offers.
          </p>
          <NewsletterSignup />
        </div>
      </div>
      <div className="border-t border-primary-foreground/10 py-4">
        <div className="container-boutique flex flex-col items-center justify-between gap-2 text-xs text-primary-foreground/60 sm:flex-row">
          <p>© {new Date().getFullYear()} Aruhi Handlooms. All rights reserved.</p>
          <p>Crafted in India · Handloom certified</p>
        </div>
      </div>
    </footer>
  );
}
