'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Minus, Plus, Trash2, ShoppingBag, Tag } from 'lucide-react';
import { useCart } from '@/lib/cart-context';
import { formatINR } from '@/lib/format';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';

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
  } = useCart();

  return (
    <Sheet open={isCartOpen} onOpenChange={setCartOpen}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 bg-background p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-border/60 p-5">
          <SheetTitle className="font-serif text-xl text-primary">
            Your Cart ({count})
          </SheetTitle>
          <SheetDescription className="sr-only">
            Review the items in your shopping cart
          </SheetDescription>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="rounded-full bg-muted p-5">
              <ShoppingBag className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-serif text-lg font-semibold">Your cart is empty</p>
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
            <div className="flex-1 overflow-y-auto p-5">
              <ul className="flex flex-col gap-4">
                {items.map((item) => (
                  <li
                    key={`${item.product.id}-${item.size}`}
                    className="flex gap-3"
                  >
                    <Link
                      href={`/product/${item.product.slug}`}
                      onClick={() => setCartOpen(false)}
                      className="relative h-24 w-20 shrink-0 overflow-hidden rounded-md bg-muted"
                    >
                      <Image
                        src={item.product.images[0] || 'https://placehold.co/80x100?text=No+Image'}
                        alt={`${item.product.name} - ${item.product.fabric} ${item.product.category}`}
                        fill
                        sizes="80px"
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
                          onClick={() => removeItem(item.product.id, item.size)}
                          className="text-muted-foreground transition-colors hover:text-destructive"
                          aria-label="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Size: {item.size}
                      </p>
                      <div className="mt-auto flex items-center justify-between pt-2">
                        <div className="flex items-center rounded-md border border-border">
                          <button
                            onClick={() =>
                              updateQuantity(item.product.id, item.size, item.quantity - 1)
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
                              updateQuantity(item.product.id, item.size, item.quantity + 1)
                            }
                            className="p-1.5 text-muted-foreground hover:text-primary"
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <span className="font-serif text-sm font-bold text-primary">
                          {formatINR(item.product.price * item.quantity)}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-border/60 p-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className={couponDiscount > 0 ? 'text-sm font-medium line-through text-muted-foreground' : 'font-serif text-lg font-bold text-primary'}>
                  {formatINR(subtotal)}
                </span>
              </div>
              {appliedCoupon && couponDiscount > 0 && (
                <>
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-secondary-foreground">
                      <Tag className="h-3.5 w-3.5" /> {appliedCoupon.code}
                    </span>
                    <span className="text-secondary-foreground">
                      -{formatINR(couponDiscount)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span className="font-medium">Estimated total</span>
                    <span className="font-serif text-lg font-bold text-primary">
                      {formatINR(Math.max(0, subtotal - couponDiscount))}
                    </span>
                  </div>
                </>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                Shipping & taxes calculated at checkout.
              </p>
              <Separator className="my-4" />
              <div className="flex flex-col gap-2">
                <Button asChild className="bg-primary" onClick={() => setCartOpen(false)}>
                  <Link href="/checkout">Checkout</Link>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCartOpen(false)}
                  asChild
                >
                  <Link href="/cart">View Cart</Link>
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
