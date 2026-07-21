'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Minus,
  Plus,
  Trash2,
  ShoppingBag,
  Tag,
  ArrowLeft,
  X,
  Loader2,
  ChevronDown,
  ChevronRight,
  Info,
} from 'lucide-react';
import { useCart } from '@/lib/cart-context';
import { useAuth } from '@/lib/auth-context';
import { markCheckoutEntry } from '@/lib/checkout-return';
import { formatINR, discountPct } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import CartBump from '@/components/cart/cart-bump';
import LowStockBadge from '@/components/growth/low-stock-badge';

export default function CartDrawer() {
  const {
    items,
    isCartOpen,
    setCartOpen,
    updateQuantity,
    removeItem,
    subtotal,
    count,
    appliedCoupon,
    couponDiscount,
    applyCoupon,
    removeCoupon,
    clearBuyNow,
  } = useCart();
  const { user } = useAuth();

  const [couponInput, setCouponInput] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponPanelOpen, setCouponPanelOpen] = useState(false);
  const [priceDetailsOpen, setPriceDetailsOpen] = useState(false);

  // Swipe-to-close for the side cart on mobile — drag the panel toward the
  // right edge (the side it slides in from) to dismiss it, same gesture
  // shoppers already expect from apps like this. Kept as plain touch
  // handlers + direct style writes on the panel DOM node (not React state
  // per move) so dragging feels immediate with no re-render lag. Only
  // engages once a touch clearly moves more horizontally than vertically,
  // so scrolling the item list up/down is never hijacked.
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    lastX: number;
    lastT: number;
    velocity: number;
    mode: 'undecided' | 'horizontal' | 'vertical';
  } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    dragRef.current = {
      startX: t.clientX,
      startY: t.clientY,
      lastX: t.clientX,
      lastT: Date.now(),
      velocity: 0,
      mode: 'undecided',
    };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const t = e.touches[0];
    const dx = t.clientX - drag.startX;
    const dy = t.clientY - drag.startY;

    if (drag.mode === 'undecided') {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      drag.mode = Math.abs(dx) > Math.abs(dy) && dx > 0 ? 'horizontal' : 'vertical';
    }
    if (drag.mode !== 'horizontal') return;

    e.preventDefault();
    const now = Date.now();
    const dt = now - drag.lastT;
    if (dt > 0) drag.velocity = (t.clientX - drag.lastX) / dt;
    drag.lastX = t.clientX;
    drag.lastT = now;

    const translate = Math.max(0, dx);
    if (panelRef.current) {
      panelRef.current.style.transition = 'none';
      panelRef.current.style.transform = `translateX(${translate}px)`;
    }
  };

  const onTouchEnd = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.mode !== 'horizontal' || !panelRef.current) return;

    const dx = Math.max(0, drag.lastX - drag.startX);
    const panelWidth = panelRef.current.offsetWidth || 1;
    const shouldClose = dx > panelWidth * 0.3 || drag.velocity > 0.5;

    if (shouldClose) {
      // Hand off to Radix's own close animation instead of fighting it
      // with our inline transform.
      panelRef.current.style.transition = '';
      panelRef.current.style.transform = '';
      setCartOpen(false);
    } else {
      panelRef.current.style.transition = 'transform 200ms ease';
      panelRef.current.style.transform = 'translateX(0px)';
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    setCouponError(null);
    setApplyingCoupon(true);
    const result = await applyCoupon(couponInput);
    setApplyingCoupon(false);
    if (!result.ok) {
      setCouponError(result.error || 'Invalid coupon');
      return;
    }
    setCouponInput('');
    setCouponPanelOpen(false);
  };

  const handleRemoveCoupon = () => {
    removeCoupon();
    setCouponInput('');
    setCouponError(null);
  };

  // Total rupee amount the shopper is saving on this bag — MRP discount on
  // every line item, plus whatever the applied coupon knocks off. Drives
  // the green savings strip pinned above the Checkout button.
  const mrpSavings = items.reduce((sum, i) => {
    const mrp = i.product.mrp ?? i.product.price;
    return sum + Math.max(0, mrp - i.product.price) * i.quantity;
  }, 0);
  const totalSavings = mrpSavings + couponDiscount;

  return (
    <Sheet
      open={isCartOpen}
      onOpenChange={(open) => {
        if (open && panelRef.current) {
          panelRef.current.style.transition = '';
          panelRef.current.style.transform = '';
        }
        setCartOpen(open);
      }}
    >
      <SheetContent
        ref={panelRef}
        side="right"
        className="flex w-full flex-col gap-0 bg-background p-0 sm:max-w-md"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <SheetHeader className="flex-row items-center gap-3 space-y-0 border-b border-border/60 p-5">
          <button
            type="button"
            onClick={() => setCartOpen(false)}
            aria-label="Back"
            className="-ml-1 rounded-sm p-1 text-foreground/80 transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-baseline gap-2">
            <SheetTitle className="font-serif text-xl font-bold text-primary">
              Bag
            </SheetTitle>
            <span className="text-sm text-muted-foreground">
              {count} item{count === 1 ? '' : 's'}
            </span>
          </div>
          <SheetDescription className="sr-only">
            Review the items in your shopping bag
          </SheetDescription>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="rounded-full bg-muted p-5">
              <ShoppingBag className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-serif text-lg font-semibold">Your bag is empty</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add some beautiful pieces to get started.
              </p>
            </div>
            <Button asChild onClick={() => setCartOpen(false)} className="bg-primary">
              <Link href="/shop">Browse Collection</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto bg-muted/40 p-4">
              {!user && (
                <div className="rounded-lg border border-border/60 bg-card p-4">
                  <p className="text-sm font-medium text-foreground">
                    Get Started &amp; grab best offers!
                  </p>
                  <Link
                    href="/login"
                    onClick={() => setCartOpen(false)}
                    className="mt-3 block rounded-full border border-primary/40 py-2 text-center text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
                  >
                    Login / Register
                  </Link>
                </div>
              )}

              <div className="flex flex-col gap-3">
                {items.map((item) => {
                  const discount = discountPct(item.product.price, item.product.mrp);
                  const mrp = item.product.mrp ?? item.product.price;
                  return (
                    <div
                      key={`${item.product.id}-${item.size}-${item.product.colors?.[0] ?? ''}`}
                      className="rounded-lg border border-border/60 bg-card p-4"
                    >
                      <div className="flex gap-3">
                        <Link
                          href={`/product/${item.product.slug}`}
                          onClick={() => setCartOpen(false)}
                          className="relative h-20 w-16 shrink-0 overflow-hidden rounded-md bg-muted"
                        >
                          <Image
                            src={item.product.images[0] || 'https://placehold.co/64x80?text=No+Image'}
                            alt={`${item.product.name} - ${item.product.fabric} ${item.product.category}`}
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        </Link>
                        <div className="flex flex-1 flex-col">
                          <div className="flex items-start justify-between gap-2">
                            <Link
                              href={`/product/${item.product.slug}`}
                              onClick={() => setCartOpen(false)}
                              className="line-clamp-2 text-sm font-medium hover:text-primary"
                            >
                              {item.product.name}
                            </Link>
                            <button
                              onClick={() =>
                                removeItem(item.product.id, item.size, item.product.colors?.[0] ?? null)
                              }
                              className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                              aria-label="Remove item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Size: {item.size}
                            {item.product.colors?.[0] ? ` · ${item.product.colors[0]}` : ''}
                          </p>
                          <div className="mt-1">
                            <LowStockBadge stockQuantity={item.product.stock_quantity} />
                          </div>
                        </div>
                      </div>

                      <Separator className="my-3" />

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Quantity :</span>
                        <div className="flex items-center rounded-md border border-border">
                          <button
                            onClick={() =>
                              updateQuantity(item.product.id, item.size, item.quantity - 1, item.product.colors?.[0] ?? null)
                            }
                            className="p-1.5 text-muted-foreground hover:text-primary"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-7 text-center text-sm font-medium">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              updateQuantity(item.product.id, item.size, item.quantity + 1, item.product.colors?.[0] ?? null)
                            }
                            className="p-1.5 text-muted-foreground hover:text-primary"
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <Separator className="my-3" />

                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          You Pay <Info className="h-3.5 w-3.5" />
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="font-serif text-base font-bold text-primary">
                            {formatINR(item.product.price * item.quantity)}
                          </span>
                          {mrp > item.product.price && (
                            <span className="text-xs text-muted-foreground line-through">
                              {formatINR(mrp * item.quantity)}
                            </span>
                          )}
                          {discount > 0 && (
                            <span className="text-xs font-semibold text-green-600">
                              {discount}% off
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Coupons */}
              <div className="rounded-lg border border-border/60 bg-card">
                {appliedCoupon ? (
                  <div className="flex items-center justify-between p-4">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-secondary-foreground">
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
                  <button
                    type="button"
                    onClick={() => setCouponPanelOpen((o) => !o)}
                    className="flex w-full items-center justify-between gap-2 p-4 text-left"
                  >
                    <span className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                        <Tag className="h-4 w-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold">Coupons</span>
                        <span className="block text-xs text-primary">
                          Apply now and save extra!
                        </span>
                      </span>
                    </span>
                    {couponPanelOpen ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                )}
                {!appliedCoupon && couponPanelOpen && (
                  <div className="border-t border-border/60 p-4">
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
                  </div>
                )}
              </div>

              {/* Price details */}
              <div className="rounded-lg border border-border/60 bg-card">
                <button
                  type="button"
                  onClick={() => setPriceDetailsOpen((o) => !o)}
                  className="flex w-full items-center justify-between p-4 text-left"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <ShoppingBag className="h-4 w-4 text-muted-foreground" /> Price details
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold">
                      {formatINR(Math.max(0, subtotal - couponDiscount))}
                    </span>
                    {priceDetailsOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </span>
                </button>
                {priceDetailsOpen && (
                  <div className="flex flex-col gap-2 border-t border-border/60 p-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatINR(subtotal)}</span>
                    </div>
                    {appliedCoupon && couponDiscount > 0 && (
                      <div className="flex items-center justify-between text-secondary-foreground">
                        <span className="flex items-center gap-1.5">
                          <Tag className="h-3.5 w-3.5" /> {appliedCoupon.code}
                        </span>
                        <span>-{formatINR(couponDiscount)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex items-center justify-between font-serif text-base font-bold text-primary">
                      <span>Total</span>
                      <span>{formatINR(Math.max(0, subtotal - couponDiscount))}</span>
                    </div>
                  </div>
                )}
              </div>

              <CartBump compact />
            </div>

            <div className="border-t border-border/60">
              {totalSavings > 0 && (
                <p className="bg-secondary/15 px-5 py-2 text-center text-sm font-medium text-secondary-foreground">
                  You are saving {formatINR(totalSavings)} on this order
                </p>
              )}
              <div className="p-5">
                <p className="mb-3 text-xs text-muted-foreground">
                  Shipping &amp; taxes calculated at checkout.
                </p>
                <div className="flex flex-col gap-2">
                  <Button
                    asChild
                    className="bg-primary"
                    onClick={() => {
                      setCartOpen(false);
                      clearBuyNow();
                      markCheckoutEntry();
                    }}
                  >
                    <Link href="/checkout">Checkout</Link>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setCartOpen(false)}
                    asChild
                  >
                    <Link href="/cart">View Bag</Link>
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
