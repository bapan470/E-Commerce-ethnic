'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, Tag, X, Loader2 } from 'lucide-react';
import { useCart } from '@/lib/cart-context';
import { formatINR } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  ShippingSettings,
  DEFAULT_SHIPPING_SETTINGS,
  fetchShippingSettings,
} from '@/lib/pincode-api';

export default function CartPage() {
  const {
    items,
    updateQuantity,
    removeItem,
    subtotal,
    clearCart,
    appliedCoupon,
    couponDiscount,
    applyCoupon,
    removeCoupon,
  } = useCart();
  const [shippingSettings, setShippingSettings] = useState<ShippingSettings>(
    DEFAULT_SHIPPING_SETTINGS
  );
  const [couponInput, setCouponInput] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  const handleApplyCoupon = async () => {
    setCouponError(null);
    setApplyingCoupon(true);
    const result = await applyCoupon(couponInput);
    setApplyingCoupon(false);
    if (!result.ok) {
      setCouponError(result.error || 'Invalid coupon');
      return;
    }
    setCouponInput('');
  };

  const handleRemoveCoupon = () => {
    removeCoupon();
    setCouponInput('');
    setCouponError(null);
  };

  useEffect(() => {
    fetchShippingSettings().then(setShippingSettings).catch(() => {
      // fall back to defaults already set above
    });
  }, []);

  if (items.length === 0) {
    return (
      <div className="container-boutique flex flex-col items-center gap-5 py-24 text-center">
        <div className="rounded-full bg-muted p-6">
          <ShoppingBag className="h-10 w-10 text-muted-foreground" />
        </div>
        <div>
          <h1 className="font-serif text-2xl font-bold text-primary">Your cart is empty</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Looks like you haven’t added anything yet.
          </p>
        </div>
        <Button asChild className="bg-primary">
          <Link href="/shop">Start Shopping</Link>
        </Button>
      </div>
    );
  }

  const shipping =
    shippingSettings.free_shipping_threshold > 0 &&
    subtotal >= shippingSettings.free_shipping_threshold
      ? 0
      : shippingSettings.flat_rate;
  const discountedSubtotal = Math.max(0, subtotal - couponDiscount);
  const total = discountedSubtotal + shipping;

  return (
    <div className="container-boutique py-8">
      <h1 className="mb-6 font-serif text-3xl font-bold text-primary sm:text-4xl">
        Shopping Cart
      </h1>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ul className="flex flex-col gap-4">
            {items.map((item) => (
              <li
                key={`${item.product.id}-${item.size}`}
                className="flex gap-4 rounded-lg border border-border/60 bg-card p-4"
              >
                <Link
                  href={`/product/${item.product.slug}`}
                  className="relative h-32 w-24 shrink-0 overflow-hidden rounded-md bg-muted"
                >
                  <Image
                    src={item.product.images[0] || 'https://placehold.co/96x120?text=No+Image'}
                    alt={`${item.product.name} - ${item.product.fabric} ${item.product.category}`}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                </Link>
                <div className="flex flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link
                        href={`/product/${item.product.slug}`}
                        className="font-serif text-base font-semibold hover:text-primary"
                      >
                        {item.product.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.product.category} · Size: {item.size}
                      </p>
                    </div>
                    <button
                      onClick={() => removeItem(item.product.id, item.size)}
                      className="text-muted-foreground transition-colors hover:text-destructive"
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-auto flex items-end justify-between pt-3">
                    <div className="flex items-center rounded-md border border-border">
                      <button
                        onClick={() => updateQuantity(item.product.id, item.size, item.quantity - 1)}
                        className="p-2 text-muted-foreground hover:text-primary"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-8 text-center text-sm font-semibold">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.product.id, item.size, item.quantity + 1)}
                        className="p-2 text-muted-foreground hover:text-primary"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="text-right">
                      <p className="font-serif text-base font-bold text-primary">
                        {formatINR(item.product.price * item.quantity)}
                      </p>
                      {item.quantity > 1 && (
                        <p className="text-xs text-muted-foreground">
                          {formatINR(item.product.price)} each
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex justify-between">
            <Button asChild variant="outline">
              <Link href="/shop">Continue Shopping</Link>
            </Button>
            <Button variant="ghost" onClick={clearCart} className="text-destructive">
              Clear cart
            </Button>
          </div>
        </div>

        <aside className="lg:col-span-1">
          <div className="sticky top-24 rounded-lg border border-border/60 bg-card p-5">
            <h2 className="font-serif text-lg font-bold text-primary">
              Order Summary
            </h2>
            <Separator className="my-4" />

            {/* Coupon */}
            <div>
              {appliedCoupon ? (
                <div className="flex items-center justify-between rounded-md bg-secondary/10 px-3 py-2 text-sm">
                  <span className="flex items-center gap-1.5 font-medium text-secondary-foreground">
                    <Tag className="h-3.5 w-3.5" /> {appliedCoupon.code} applied
                  </span>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    aria-label="Remove coupon"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Coupon code"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      className="h-9"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 shrink-0"
                      disabled={applyingCoupon || !couponInput.trim()}
                      onClick={handleApplyCoupon}
                    >
                      {applyingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                    </Button>
                  </div>
                  {couponError && <p className="text-xs text-destructive">{couponError}</p>}
                </div>
              )}
            </div>
            <Separator className="my-4" />

            <div className="flex flex-col gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatINR(subtotal)}</span>
              </div>
              {couponDiscount > 0 && (
                <div className="flex justify-between text-secondary-foreground">
                  <span>Coupon discount</span>
                  <span>-{formatINR(couponDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span className="font-medium">
                  {shipping === 0 ? (
                    <span className="text-secondary">FREE</span>
                  ) : (
                    formatINR(shipping)
                  )}
                </span>
              </div>
              {shipping > 0 && (
                <p className="text-xs text-muted-foreground">
                  Add {formatINR(2000 - subtotal)} more for free shipping.
                </p>
              )}
            </div>
            <Separator className="my-4" />
            <div className="flex items-center justify-between">
              <span className="font-serif text-base font-semibold">Total</span>
              <span className="font-serif text-xl font-bold text-primary">
                {formatINR(total)}
              </span>
            </div>
            <Button asChild size="lg" className="mt-5 w-full gap-2 bg-primary">
              <Link href="/checkout">
                Proceed to Checkout <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
