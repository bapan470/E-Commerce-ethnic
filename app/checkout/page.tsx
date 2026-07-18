'use client';

import { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Lock, Loader2, CreditCard, Tag, X, Wallet } from 'lucide-react';
import { useCart } from '@/lib/cart-context';
import { formatINR } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import { validateCoupon, Coupon } from '@/lib/coupons-api';
import {
  ShippingSettings,
  DEFAULT_SHIPPING_SETTINGS,
  fetchShippingSettings,
} from '@/lib/pincode-api';
import { trackEvent, getSessionId } from '@/lib/track-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, clearCart } = useCart();
  const [placing, setPlacing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cod'>('online');

  const [couponInput, setCouponInput] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);

  const [shippingSettings, setShippingSettings] = useState<ShippingSettings>(
    DEFAULT_SHIPPING_SETTINGS
  );

  // Abandoned-cart recovery: once the shopper has typed an email, ping the
  // tracking API (debounced) so we can email them later if they never finish.
  const [trackingEmail, setTrackingEmail] = useState('');
  useEffect(() => {
    if (!trackingEmail || !trackingEmail.includes('@') || items.length === 0) return;
    const timer = setTimeout(() => {
      fetch('/api/cart-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trackingEmail,
          items: items.map((i) => ({
            product_name: i.product.name,
            size: i.size,
            quantity: i.quantity,
            price: i.product.price,
          })),
          cartValue: subtotal,
        }),
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, [trackingEmail, items, subtotal]);

  useEffect(() => {
    fetchShippingSettings().then(setShippingSettings).catch(() => {
      // fall back to defaults already set above
    });
  }, []);

  // Log the funnel step once — used by Admin > Analytics for conversion rate.
  useEffect(() => {
    if (items.length > 0) {
      trackEvent('checkout_start', { metadata: { itemCount: items.length, cartValue: subtotal } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shipping =
    shippingSettings.free_shipping_threshold > 0 &&
    subtotal >= shippingSettings.free_shipping_threshold
      ? 0
      : shippingSettings.flat_rate;
  const discountedSubtotal = Math.max(0, subtotal - couponDiscount);
  const tax = Math.round(discountedSubtotal * (shippingSettings.gst_rate_percent / 100));
  const total = discountedSubtotal + shipping + tax;

  const handleApplyCoupon = async () => {
    setCouponError(null);
    setApplyingCoupon(true);
    const result = await validateCoupon(couponInput, subtotal);
    setApplyingCoupon(false);
    if (!result.ok || !result.coupon) {
      setCouponError(result.error || 'Invalid coupon');
      return;
    }
    setAppliedCoupon(result.coupon);
    setCouponDiscount(result.discount || 0);
    toast.success(`Coupon "${result.coupon.code}" applied`);
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponDiscount(0);
    setCouponInput('');
    setCouponError(null);
  };

  const openRazorpayCheckout = (
    razorpayOrderId: string,
    keyId: string,
    internalOrderId: string,
    customerName: string,
    customerEmail: string,
    customerPhone: string
  ) => {
    return new Promise<void>((resolve, reject) => {
      const options = {
        key: keyId,
        order_id: razorpayOrderId,
        name: 'Aruhi Handlooms',
        description: 'Handwoven Ethnic Wear Purchase',
        image: 'https://images.pexels.com/photos/1191349/pexels-photo-1191349.jpeg?auto=compress&cs=tinysrgb&w=200',
        prefill: {
          name: customerName,
          email: customerEmail,
          contact: customerPhone,
        },
        theme: {
          color: '#7c3a1d',
        },
        handler: async (response: any) => {
          try {
            const verifyRes = await fetch('/api/razorpay/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok || !verifyData.verified) {
              throw new Error(verifyData.error || 'Signature verification failed');
            }

            const { error: updateError } = await supabase
              .from('orders')
              .update({
                status: 'paid',
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              })
              .eq('id', internalOrderId);

            if (updateError) throw updateError;

            resolve();
          } catch (err) {
            reject(err);
          }
        },
        modal: {
          ondismiss: () => {
            reject(new Error('Payment cancelled'));
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (resp: any) => {
        reject(new Error(resp.error?.description || 'Payment failed'));
      });
      rzp.open();
    });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    const customerName = `${fd.get('firstName') || ''} ${fd.get('lastName') || ''}`.trim();
    const customerEmail = (fd.get('email') as string) || '';
    const customerPhone = (fd.get('phone') as string) || '';
    const shippingAddress = {
      address: fd.get('address') || '',
      address2: fd.get('address2') || '',
      city: fd.get('city') || '',
      state: fd.get('state') || '',
      pincode: fd.get('pincode') || '',
      country: fd.get('country') || 'India',
    };

    setPlacing(true);

    try {
      // 1. Create internal order in Supabase with status 'pending'
      const orderItems = items.map((i) => ({
        product_id: i.product.id,
        product_name: i.product.name,
        image_url: i.product.images?.[0] ?? null,
        color: i.product.colors?.[0] ?? null,
        size: i.size,
        quantity: i.quantity,
        price: i.product.price,
      }));

      const {
        data: { user: loggedInUser },
      } = await getSupabaseBrowser().auth.getUser();

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          items: orderItems,
          total_amount: total,
          status: 'pending',
          payment_method: paymentMethod,
          shipping_address: shippingAddress,
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone,
          user_id: loggedInUser?.id ?? null,
          session_id: getSessionId(),
          subtotal,
          shipping_charge: shipping,
          gst_amount: tax,
          coupon_code: appliedCoupon?.code ?? null,
          coupon_discount: couponDiscount,
        })
        .select('id')
        .single();

      if (orderError) throw orderError;
      const internalOrderId = orderData.id;

      // 2. Cash on Delivery — no online payment step, order is confirmed as-is
      // and payment is collected at delivery time.
      if (paymentMethod === 'cod') {
        if (appliedCoupon) {
          supabase
            .from('coupons')
            .update({ times_used: appliedCoupon.times_used + 1 })
            .eq('id', appliedCoupon.id)
            .then(() => {});
        }
        clearCart();
        trackEvent('purchase', {
          orderId: internalOrderId,
          userId: loggedInUser?.id ?? null,
          metadata: { total, itemCount: items.length, paymentMethod: 'cod', email: customerEmail },
        });
        toast.success('Order placed! Pay cash on delivery.');
        fetch('/api/order-confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: internalOrderId }),
        }).catch(() => {});
        router.push(`/order-confirmation/${internalOrderId}`);
        return;
      }

      // 3. Create Razorpay order via API route
      const createOrderRes = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: total * 100, // convert to paise
          internalOrderId,
        }),
      });
      const createOrderData = await createOrderRes.json();
      if (!createOrderRes.ok) {
        // Mark order as failed
        await supabase.from('orders').update({ status: 'failed' }).eq('id', internalOrderId);
        throw new Error(createOrderData.error || 'Failed to create payment order');
      }

      // 4. Open Razorpay checkout popup
      await openRazorpayCheckout(
        createOrderData.order.id,
        createOrderData.keyId,
        internalOrderId,
        customerName,
        customerEmail,
        customerPhone
      );

      // 5. Payment succeeded and verified.
      if (appliedCoupon) {
        // Best-effort — a failed increment shouldn't block order confirmation.
        supabase
          .from('coupons')
          .update({ times_used: appliedCoupon.times_used + 1 })
          .eq('id', appliedCoupon.id)
          .then(() => {});
      }
      clearCart();
      trackEvent('purchase', {
        orderId: internalOrderId,
        userId: loggedInUser?.id ?? null,
        metadata: { total, itemCount: items.length, paymentMethod: 'online', email: customerEmail },
      });
      toast.success('Payment successful! Order confirmed.');
      fetch('/api/order-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: internalOrderId }),
      }).catch(() => {});
      router.push(`/order-confirmation/${internalOrderId}`);
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to place order';
      if (message.includes('cancelled')) {
        toast.error('Payment was cancelled. Your order is saved as pending.');
      } else {
        toast.error(message);
      }
    } finally {
      setPlacing(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="container-boutique flex flex-col items-center gap-5 py-24 text-center">
        <h1 className="font-serif text-2xl font-bold text-primary">
          Your cart is empty
        </h1>
        <p className="text-sm text-muted-foreground">
          Add items to your cart before checking out.
        </p>
        <Button asChild className="bg-primary">
          <Link href="/shop">Browse Collection</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container-boutique py-8">
      <h1 className="mb-6 font-serif text-3xl font-bold text-primary sm:text-4xl">
        Checkout
      </h1>

      <form onSubmit={onSubmit} className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {/* Contact */}
          <section className="rounded-lg border border-border/60 bg-card p-5">
            <h2 className="mb-4 font-serif text-lg font-bold text-primary">
              Contact Information
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="firstName">First name *</Label>
                <Input id="firstName" name="firstName" required placeholder="Aanya" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="lastName">Last name *</Label>
                <Input id="lastName" name="lastName" required placeholder="Sharma" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="aanya@example.com"
                  onChange={(e) => setTrackingEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="phone">Phone *</Label>
                <Input id="phone" name="phone" type="tel" required placeholder="+91 98765 43210" />
              </div>
            </div>
          </section>

          {/* Shipping */}
          <section className="mt-4 rounded-lg border border-border/60 bg-card p-5">
            <h2 className="mb-4 font-serif text-lg font-bold text-primary">
              Shipping Address
            </h2>
            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="address">Street address *</Label>
                <Input id="address" name="address" required placeholder="12, MG Road, Apt 304" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="address2">Apartment, suite, etc. (optional)</Label>
                <Input id="address2" name="address2" placeholder="Bandra West" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="city">City *</Label>
                  <Input id="city" name="city" required placeholder="Mumbai" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="state">State *</Label>
                  <Input id="state" name="state" required placeholder="Maharashtra" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="pincode">PIN code *</Label>
                  <Input id="pincode" name="pincode" required placeholder="400050" inputMode="numeric" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="country">Country *</Label>
                  <Input id="country" name="country" required defaultValue="India" />
                </div>
              </div>
            </div>
          </section>

          {/* Payment info */}
          <section className="mt-4 rounded-lg border border-border/60 bg-card p-5">
            <h2 className="mb-1 font-serif text-lg font-bold text-primary">Payment</h2>
            <p className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" /> Choose how you'd like to pay
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('online')}
                className={`flex items-start gap-3 rounded-md border p-3 text-left text-sm transition-colors ${
                  paymentMethod === 'online'
                    ? 'border-primary bg-primary/5'
                    : 'border-border/60 hover:border-primary/40'
                }`}
              >
                <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
                <div>
                  <p className="font-medium">Pay Online</p>
                  <p className="text-xs text-muted-foreground">
                    Razorpay (Test Mode) — card, UPI, netbanking
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('cod')}
                className={`flex items-start gap-3 rounded-md border p-3 text-left text-sm transition-colors ${
                  paymentMethod === 'cod'
                    ? 'border-primary bg-primary/5'
                    : 'border-border/60 hover:border-primary/40'
                }`}
              >
                <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
                <div>
                  <p className="font-medium">Cash on Delivery</p>
                  <p className="text-xs text-muted-foreground">Pay in cash when your order arrives</p>
                </div>
              </button>
            </div>

            {paymentMethod === 'online' ? (
              <div className="mt-3 flex items-center gap-3 rounded-md bg-muted/50 p-3 text-sm">
                <CreditCard className="h-5 w-5 text-secondary" />
                <div>
                  <p className="font-medium">Razorpay Test Payment</p>
                  <p className="text-xs text-muted-foreground">
                    Use test card: 4111 1111 1111 1111, any expiry, any CVV
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-3 rounded-md bg-muted/50 p-3 text-sm">
                <Wallet className="h-5 w-5 text-secondary" />
                <div>
                  <p className="font-medium">Pay {formatINR(total)} on delivery</p>
                  <p className="text-xs text-muted-foreground">
                    Keep exact change ready for our delivery partner.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Summary */}
        <aside className="lg:col-span-1">
          <div className="sticky top-24 rounded-lg border border-border/60 bg-card p-5">
            <h2 className="font-serif text-lg font-bold text-primary">Order Summary</h2>
            <Separator className="my-4" />
            <ul className="flex max-h-72 flex-col gap-3 overflow-y-auto">
              {items.map((item) => (
                <li
                  key={`${item.product.id}-${item.size}`}
                  className="flex gap-3"
                >
                  <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                    <Image
                      src={item.product.images[0] || 'https://placehold.co/56x64?text=No+Image'}
                      alt={`${item.product.name} - ${item.product.fabric} ${item.product.category}`}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                      {item.quantity}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col justify-center">
                    <p className="line-clamp-1 text-xs font-medium">
                      {item.product.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Size: {item.size}
                    </p>
                  </div>
                  <span className="self-center text-xs font-semibold">
                    {formatINR(item.product.price * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
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
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatINR(subtotal)}</span>
              </div>
              {couponDiscount > 0 && (
                <div className="flex justify-between text-secondary-foreground">
                  <span>Coupon discount</span>
                  <span>-{formatINR(couponDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span>{shipping === 0 ? 'FREE' : formatINR(shipping)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Tax ({shippingSettings.gst_rate_percent}% GST)
                </span>
                <span>{formatINR(tax)}</span>
              </div>
            </div>
            <Separator className="my-4" />
            <div className="flex items-center justify-between">
              <span className="font-serif text-base font-semibold">Total</span>
              <span className="font-serif text-xl font-bold text-primary">
                {formatINR(total)}
              </span>
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={placing}
              className="mt-5 w-full bg-primary"
            >
              {placing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : paymentMethod === 'cod' ? (
                <>
                  <Wallet className="mr-2 h-4 w-4" />
                  Place Order (COD) — {formatINR(total)}
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Pay {formatINR(total)}
                </>
              )}
            </Button>
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              By placing your order, you agree to our Terms & Privacy Policy.
            </p>
          </div>
        </aside>
      </form>
    </div>
  );
}
