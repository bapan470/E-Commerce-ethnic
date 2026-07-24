'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Lock, Loader2, CreditCard, Tag, X, Wallet, Sparkles, Gift, Store, Minus, Plus } from 'lucide-react';
import { useCart } from '@/lib/cart-context';
import { useAuth } from '@/lib/auth-context';
import { formatINR } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import { validateGiftCard, GiftCard } from '@/lib/giftcards-api';
import { computeCouponDiscount } from '@/lib/coupons-api';
import { fetchAddresses } from '@/lib/addresses-api';
import { Address } from '@/lib/types';
import { joinResellerProgram, fetchMyResellerOverview } from '@/lib/reseller-api';
import {
  fetchLoyaltySettings,
  fetchMyLoyaltyBalance,
  DEFAULT_LOYALTY_SETTINGS,
  LoyaltySettings,
} from '@/lib/loyalty-api';
import {
  ShippingSettings,
  DEFAULT_SHIPPING_SETTINGS,
  fetchShippingSettings,
} from '@/lib/pincode-api';
import { trackEvent, getSessionId } from '@/lib/track-api';
import {
  CheckoutBumpSettings,
  DEFAULT_CHECKOUT_BUMP_SETTINGS,
  fetchCheckoutBumpSettings,
} from '@/lib/checkout-bump-api';
import { fetchProductById } from '@/lib/products-api';
import { decrementStockForOrder } from '@/lib/stock-api';
import { Product, CartItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import TrustBadges from '@/components/checkout/trust-badges';
import { toast } from 'sonner';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function CheckoutPage() {
  const router = useRouter();
  const {
    items: cartItems,
    subtotal: cartSubtotal,
    clearCart,
    addItem,
    removeItem,
    updateQuantity,
    appliedCoupon,
    couponDiscount: cartCouponDiscount,
    applyCoupon,
    removeCoupon,
    buyNowItem,
    updateBuyNowQuantity,
    clearBuyNow,
  } = useCart();
  // Buy Now sends the shopper straight here with just the one item, kept
  // separate from whatever else is sitting in the persistent cart. Extra
  // add-ons picked up on this page (currently just the checkout bump) are
  // tracked locally here rather than going into the real cart.
  const isBuyNow = !!buyNowItem;
  const [buyNowExtras, setBuyNowExtras] = useState<CartItem[]>([]);
  const items = buyNowItem ? [buyNowItem, ...buyNowExtras] : cartItems;
  const subtotal = isBuyNow
    ? items.reduce((sum, i) => sum + i.product.price * i.quantity, 0)
    : cartSubtotal;
  const couponDiscount = isBuyNow
    ? appliedCoupon && subtotal >= appliedCoupon.min_order_value
      ? computeCouponDiscount(appliedCoupon, subtotal, items.length)
      : 0
    : cartCouponDiscount;
  const [placing, setPlacing] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cod'>('online');
  const { user } = useAuth();

  // Saved addresses — lets a logged-in customer pick a previously saved
  // address instead of retyping it. Shipping fields are controlled so we
  // can fill them in programmatically when one is picked.
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('new');
  // When a logged-in customer has a saved/default address, we show a compact
  // read-only summary instead of the full editable form. "Change address"
  // flips this to true to reveal the picker + editable fields again.
  const [showAddressForm, setShowAddressForm] = useState(false);
  // "Choose Address" opens a dialog with a radio list of saved addresses,
  // a "+ New Address" option, and an "Edit" action for the highlighted one.
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [pickerSelectedId, setPickerSelectedId] = useState<string>('new');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [shipPhone, setShipPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [pincode, setPincode] = useState('');
  const [country, setCountry] = useState('India');

  // Bug fix: clicking "Log In" / "Create Account" from the resell prompt used
  // to send the shopper to /login or /signup and back, which remounts this
  // page and wipes out whatever address they'd already typed. We snapshot the
  // in-progress form into sessionStorage right before navigating away, and
  // restore it here once they land back on /checkout — so guest or existing
  // customer, they never have to retype the address.
  const CHECKOUT_ADDRESS_DRAFT_KEY = 'aruhi_checkout_address_draft';
  // Tracks whether a draft was restored on this mount, so the saved-address
  // effect below (which normally auto-fills the customer's default address
  // once we know who they are) doesn't clobber it.
  const draftRestoredRef = useRef(false);

  const saveAddressDraft = () => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(
        CHECKOUT_ADDRESS_DRAFT_KEY,
        JSON.stringify({
          email,
          firstName,
          lastName,
          shipPhone,
          addressLine1,
          addressLine2,
          city,
          stateName,
          pincode,
          country,
        })
      );
    } catch {
      // sessionStorage unavailable (e.g. private mode) — nothing we can do,
      // the shopper will just need to retype the address as before.
    }
  };

  // Runs once on mount, before we know whether the shopper is logged in, so
  // it always wins over the saved-address auto-fill below.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(CHECKOUT_ADDRESS_DRAFT_KEY);
      if (!raw) return;
      sessionStorage.removeItem(CHECKOUT_ADDRESS_DRAFT_KEY);
      const draft = JSON.parse(raw) as Partial<{
        email: string;
        firstName: string;
        lastName: string;
        shipPhone: string;
        addressLine1: string;
        addressLine2: string;
        city: string;
        stateName: string;
        pincode: string;
        country: string;
      }>;
      setEmail(draft.email || '');
      setFirstName(draft.firstName || '');
      setLastName(draft.lastName || '');
      setShipPhone(draft.shipPhone || '');
      setAddressLine1(draft.addressLine1 || '');
      setAddressLine2(draft.addressLine2 || '');
      setCity(draft.city || '');
      setStateName(draft.stateName || '');
      setPincode(draft.pincode || '');
      setCountry(draft.country || 'India');
      setSelectedAddressId('new');
      setShowAddressForm(true);
      draftRestoredRef.current = true;
    } catch {
      // Corrupt/unreadable draft — ignore and fall back to normal behaviour.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applySavedAddress = (addr: Address) => {
    const nameParts = (addr.full_name || '').trim().split(/\s+/);
    setFirstName(nameParts[0] || '');
    setLastName(nameParts.slice(1).join(' '));
    setShipPhone(addr.phone || '');
    setAddressLine1(addr.line1 || '');
    setAddressLine2(addr.line2 || '');
    setCity(addr.city || '');
    setStateName(addr.state || '');
    setPincode(addr.pincode || '');
  };

  const handleSelectSavedAddress = (id: string) => {
    setSelectedAddressId(id);
    if (id === 'new') {
      setFirstName('');
      setLastName('');
      setShipPhone('');
      setAddressLine1('');
      setAddressLine2('');
      setCity('');
      setStateName('');
      setPincode('');
      setShowAddressForm(true);
      return;
    }
    const addr = savedAddresses.find((a) => a.id === id);
    if (addr) {
      applySavedAddress(addr);
      setShowAddressForm(false);
    }
  };

  const openAddressPicker = () => {
    setPickerSelectedId(selectedAddressId);
    setShowAddressPicker(true);
  };

  const confirmPickerSelection = () => {
    handleSelectSavedAddress(pickerSelectedId);
    setShowAddressPicker(false);
  };

  const editPickerSelection = () => {
    setSelectedAddressId(pickerSelectedId);
    if (pickerSelectedId === 'new') {
      setFirstName('');
      setLastName('');
      setShipPhone('');
      setAddressLine1('');
      setAddressLine2('');
      setCity('');
      setStateName('');
      setPincode('');
    } else {
      const addr = savedAddresses.find((a) => a.id === pickerSelectedId);
      if (addr) applySavedAddress(addr);
    }
    setShowAddressForm(true);
    setShowAddressPicker(false);
  };

  useEffect(() => {
    if (!user) {
      setSavedAddresses([]);
      return;
    }
    if (!draftRestoredRef.current) setEmail(user.email ?? '');
    fetchAddresses()
      .then((list) => {
        setSavedAddresses(list);
        // If we just restored an in-progress address draft (shopper logged
        // in / signed up mid-checkout), keep what they typed instead of
        // silently swapping in their saved default address.
        if (draftRestoredRef.current) return;
        const preferred = list.find((a) => a.is_default) || list[0];
        if (preferred) {
          setSelectedAddressId(preferred.id);
          applySavedAddress(preferred);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Resale — lets a customer mark this checkout as an order they're
  // reselling to their own customer, at a price they set themselves.
  const [isResale, setIsResale] = useState(false);
  const [showResaleConfirm, setShowResaleConfirm] = useState(false);
  const [showResaleLoginPrompt, setShowResaleLoginPrompt] = useState(false);
  const [resaleSellingPrice, setResaleSellingPrice] = useState('');
  const [resaleBrandName, setResaleBrandName] = useState('');
  const [defaultMarkup, setDefaultMarkup] = useState(100);
  useEffect(() => {
    if (!user) return;
    fetchMyResellerOverview()
      .then((o) => {
        if (o.profile) setDefaultMarkup(o.profile.default_markup_amount);
      })
      .catch(() => {});
  }, [user]);

  const [couponInput, setCouponInput] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  const [giftCardInput, setGiftCardInput] = useState('');
  const [applyingGiftCard, setApplyingGiftCard] = useState(false);
  const [giftCardError, setGiftCardError] = useState<string | null>(null);
  const [appliedGiftCard, setAppliedGiftCard] = useState<GiftCard | null>(null);
  const [giftCardDiscount, setGiftCardDiscount] = useState(0);

  const [shippingSettings, setShippingSettings] = useState<ShippingSettings>(
    DEFAULT_SHIPPING_SETTINGS
  );

  // Loyalty points — only relevant for logged-in customers.
  const [loyaltySettings, setLoyaltySettings] = useState<LoyaltySettings>(
    DEFAULT_LOYALTY_SETTINGS
  );
  const [pointsBalance, setPointsBalance] = useState(0);
  const [redeemPoints, setRedeemPoints] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);

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

  useEffect(() => {
    fetchLoyaltySettings().then(setLoyaltySettings).catch(() => {
      // fall back to defaults already set above
    });
    fetchMyLoyaltyBalance()
      .then((bal) => setPointsBalance(bal))
      .catch(() => setPointsBalance(0));
  }, []);

  // Checkout order bump — single admin-picked add-on product, independent
  // of whatever's already in the cart. Loaded once; if the customer already
  // has this exact product in cart, we don't show the bump for it again.
  const [bumpSettings, setBumpSettings] = useState<CheckoutBumpSettings>(
    DEFAULT_CHECKOUT_BUMP_SETTINGS
  );
  const [bumpProduct, setBumpProduct] = useState<Product | null>(null);
  const BUMP_SIZE = 'Free Size';

  useEffect(() => {
    fetchCheckoutBumpSettings()
      .then(async (s) => {
        setBumpSettings(s);
        if (s.enabled && s.product_id) {
          const p = await fetchProductById(s.product_id).catch(() => null);
          setBumpProduct(p);
        }
      })
      .catch(() => {});
  }, []);

  const bumpSize = bumpProduct?.sizes?.[0] || BUMP_SIZE;
  const bumpPrice = bumpProduct
    ? Math.round(bumpProduct.price * (1 - bumpSettings.discount_percent / 100))
    : 0;
  const bumpInCart = !!bumpProduct && items.some((i) => i.product.id === bumpProduct.id);

  const toggleBump = (checked: boolean) => {
    if (!bumpProduct) return;
    if (checked) {
      // Clone the product with the checkout-only bump price — cart totals,
      // the order summary and the final order_items row all read
      // item.product.price directly, so this is all that's needed.
      if (isBuyNow) {
        setBuyNowExtras((prev) => [
          ...prev,
          { product: { ...bumpProduct, price: bumpPrice }, size: bumpSize, quantity: 1, isBump: true },
        ]);
      } else {
        addItem({ ...bumpProduct, price: bumpPrice }, bumpSize, 1, { isBump: true });
      }
    } else {
      if (isBuyNow) {
        setBuyNowExtras((prev) => prev.filter((i) => i.product.id !== bumpProduct.id));
      } else {
        removeItem(bumpProduct.id, bumpSize, bumpProduct.colors?.[0] ?? null);
      }
    }
  };

  // Clears whichever mode produced this order — the single Buy Now item, or
  // the full persistent cart — without touching the other.
  const clearOrderedItems = () => {
    if (isBuyNow) {
      clearBuyNow();
      setBuyNowExtras([]);
    } else {
      clearCart();
    }
  };

  // +/- stepper in the order summary. Routes to whichever store actually
  // holds this line item: the Buy Now slot, a locally-tracked bump add-on,
  // or the real persistent cart.
  const changeItemQuantity = (item: CartItem, delta: number) => {
    const stock = item.product.stock_quantity ?? Infinity;
    const nextQty = Math.min(Math.max(1, item.quantity + delta), stock);
    if (nextQty === item.quantity) return;
    const itemColorKey = item.product.colors?.[0] ?? null;

    if (
      buyNowItem &&
      !item.isBump &&
      item.product.id === buyNowItem.product.id &&
      item.size === buyNowItem.size &&
      (buyNowItem.product.colors?.[0] ?? null) === itemColorKey
    ) {
      updateBuyNowQuantity(nextQty);
      return;
    }
    if (isBuyNow) {
      setBuyNowExtras((prev) =>
        prev.map((i) =>
          i.product.id === item.product.id &&
          i.size === item.size &&
          (i.product.colors?.[0] ?? null) === itemColorKey
            ? { ...i, quantity: nextQty }
            : i
        )
      );
      return;
    }
    updateQuantity(item.product.id, item.size, nextQty, itemColorKey);
  };

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
  const afterCouponSubtotal = Math.max(0, subtotal - couponDiscount);
  const clampedGiftCardDiscount = Math.min(giftCardDiscount, afterCouponSubtotal);
  const afterGiftCardSubtotal = Math.max(0, afterCouponSubtotal - clampedGiftCardDiscount);

  // Loyalty points can never discount more than what's left to pay after
  // the coupon and any gift card, and never more than the customer
  // actually has.
  const maxRedeemablePoints =
    loyaltySettings.redeem_value_per_point > 0
      ? Math.min(
          pointsBalance,
          Math.floor(afterGiftCardSubtotal / loyaltySettings.redeem_value_per_point)
        )
      : 0;
  const canRedeemPoints =
    loyaltySettings.enabled && pointsBalance >= loyaltySettings.min_redeem_points && maxRedeemablePoints > 0;
  const loyaltyDiscount =
    redeemPoints && canRedeemPoints
      ? Math.round(pointsToRedeem * loyaltySettings.redeem_value_per_point)
      : 0;

  const discountedSubtotal = Math.max(0, afterGiftCardSubtotal - loyaltyDiscount);
  // Prices are GST-inclusive: the tax is already baked into discountedSubtotal,
  // so we only extract it here for display/invoice purposes and do NOT add it
  // on top of the total again.
  const tax = Math.round(
    discountedSubtotal - (discountedSubtotal * 100) / (100 + shippingSettings.gst_rate_percent)
  );
  const total = discountedSubtotal + shipping;

  const resaleSellingPriceNum = Math.max(0, Number(resaleSellingPrice) || 0);
  // What the reseller's own customer actually pays — the price the reseller
  // typed in themselves. This is what gets charged/COD'd and stored as the
  // order's total_amount when resale is on. Falls back to cost if they
  // haven't set a price yet (shouldn't normally happen — see validation below).
  const payableTotal = isResale && resaleSellingPriceNum > 0 ? resaleSellingPriceNum : total;
  const resaleProfit = payableTotal - total;
  const resalePriceTooLow = isResale && resaleSellingPriceNum > 0 && resaleSellingPriceNum < total;

  const handleResaleCheckboxChange = (checked: boolean) => {
    if (checked) {
      if (!user) {
        setShowResaleLoginPrompt(true);
        return;
      }
      setShowResaleConfirm(true);
    } else {
      setIsResale(false);
    }
  };

  const confirmResaleYes = () => {
    setIsResale(true);
    setShowResaleConfirm(false);
    setResaleSellingPrice((prev) => prev || String(total + defaultMarkup));
  };

  const confirmResaleNo = () => {
    setIsResale(false);
    setShowResaleConfirm(false);
  };

  const goToResaleLogin = () => {
    saveAddressDraft();
    setShowResaleLoginPrompt(false);
    router.push('/login?next=/checkout');
  };

  const goToResaleSignup = () => {
    saveAddressDraft();
    setShowResaleLoginPrompt(false);
    router.push('/signup?next=/checkout');
  };

  const handleToggleRedeemPoints = (checked: boolean) => {
    setRedeemPoints(checked);
    if (checked) {
      setPointsToRedeem(maxRedeemablePoints);
    } else {
      setPointsToRedeem(0);
    }
  };

  const handleApplyCoupon = async () => {
    setCouponError(null);
    setApplyingCoupon(true);
    const result = await applyCoupon(couponInput, subtotal, items.length);
    setApplyingCoupon(false);
    if (!result.ok || !result.coupon) {
      setCouponError(result.error || 'Invalid coupon');
      return;
    }
    toast.success(`Coupon "${result.coupon.code}" applied`);
  };

  const handleRemoveCoupon = () => {
    removeCoupon();
    setCouponInput('');
    setCouponError(null);
  };

  const handleApplyGiftCard = async () => {
    setGiftCardError(null);
    setApplyingGiftCard(true);
    const result = await validateGiftCard(giftCardInput, afterCouponSubtotal);
    setApplyingGiftCard(false);
    if (!result.ok || !result.giftCard) {
      setGiftCardError(result.error || 'Invalid gift card code');
      return;
    }
    setAppliedGiftCard(result.giftCard);
    setGiftCardDiscount(result.redeemable || 0);
    toast.success(`Gift card "${result.giftCard.code}" applied`);
  };

  const handleRemoveGiftCard = () => {
    setAppliedGiftCard(null);
    setGiftCardDiscount(0);
    setGiftCardInput('');
    setGiftCardError(null);
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

    const customerName = `${firstName} ${lastName}`.trim();
    const customerEmail = email;
    const customerPhone = shipPhone;
    const shippingAddress = {
      address: addressLine1,
      address2: addressLine2,
      city,
      state: stateName,
      pincode,
      country: country || 'India',
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

      if (isResale && !loggedInUser) {
        toast.error('Please log in to place a resale order');
        setPlacing(false);
        return;
      }

      if (isResale && (resaleSellingPriceNum <= 0 || resaleSellingPriceNum < total)) {
        toast.error(`Selling price must be at least ${formatINR(total)} (your cost)`);
        setPlacing(false);
        return;
      }

      // If reselling, make sure this account has a reseller profile
      // (created silently on first resale checkout — same login, no
      // separate signup) so the order can be linked to it.
      let resellerId: string | null = null;
      if (isResale) {
        try {
          const resellerProfile = await joinResellerProgram(resaleProfit > 0 ? resaleProfit : defaultMarkup);
          resellerId = resellerProfile.id;
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Failed to set up reseller account');
          setPlacing(false);
          return;
        }
      }

      // Phase 3A/3B: place_order_with_items() does the `orders` insert AND
      // the per-item `order_items` insert in one atomic transaction, plus
      // (for vendor-sourced products only) an atomic check+decrement of
      // vendor stock and a vendor_accept_deadline. This replaces what used
      // to be a raw `.from('orders').insert(...)` here — see the Phase 3A
      // migration's header comment for why. Non-vendor products are
      // completely unaffected (vendor_id is NULL for them, so the RPC
      // skips the vendor-stock check for those lines); the existing
      // decrementStockForOrder() call further below still separately
      // handles the legacy customer-facing stock_quantity display for
      // every product, vendor-sourced or not.
      const { data: newOrderId, error: orderError } = await supabase.rpc('place_order_with_items', {
        p_order: {
          user_id: loggedInUser?.id ?? null,
          items: orderItems,
          total_amount: payableTotal,
          status: 'pending',
          payment_method: paymentMethod,
          shipping_address: shippingAddress,
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone,
          session_id: getSessionId(),
          subtotal,
          shipping_charge: shipping,
          gst_amount: tax,
          coupon_code: appliedCoupon?.code ?? null,
          coupon_discount: couponDiscount,
          gift_card_code: appliedGiftCard?.code ?? null,
          gift_card_discount: clampedGiftCardDiscount,
          loyalty_points_redeemed: loyaltyDiscount > 0 ? pointsToRedeem : 0,
          loyalty_discount: loyaltyDiscount,
          is_reseller_order: isResale,
          reseller_id: resellerId,
          reseller_margin_percent: isResale && total > 0 ? Number(((resaleProfit / total) * 100).toFixed(1)) : null,
          reseller_base_cost: isResale ? total : null,
          reseller_profit: isResale ? resaleProfit : null,
          reseller_brand_name: isResale ? resaleBrandName || null : null,
        },
        p_items: orderItems,
      });

      if (orderError) {
        if (orderError.message?.includes('INSUFFICIENT_STOCK')) {
          toast.error('Sorry, one of the items in your cart just sold out. Please update your cart and try again.');
          setPlacing(false);
          return;
        }
        throw orderError;
      }
      const internalOrderId = newOrderId as string;

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
        setOrderPlaced(true);
        clearOrderedItems();
        decrementStockForOrder(orderItems).catch(() => {});
        trackEvent('purchase', {
          orderId: internalOrderId,
          userId: loggedInUser?.id ?? null,
          metadata: { total: payableTotal, itemCount: items.length, paymentMethod: 'cod', email: customerEmail },
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
          amount: payableTotal * 100, // convert to paise
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
      setOrderPlaced(true);
      clearOrderedItems();
      decrementStockForOrder(orderItems).catch(() => {});
      trackEvent('purchase', {
        orderId: internalOrderId,
        userId: loggedInUser?.id ?? null,
        metadata: { total: payableTotal, itemCount: items.length, paymentMethod: 'online', email: customerEmail },
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

  if (orderPlaced) {
    return (
      <div className="container-boutique flex flex-col items-center gap-3 py-24 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Redirecting to your order confirmation…</p>
      </div>
    );
  }

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

  // Show a compact read-only summary (name, phone, email, address) instead
  // of the full form when the customer is logged in and has a saved
  // address selected. "Change address" (rendered on the right) reveals the
  // picker + editable fields again.
  const hasSavedAddressSummary =
    !!user && savedAddresses.length > 0 && !showAddressForm && selectedAddressId !== 'new';

  return (
    <div className="container-boutique py-8">
      <h1 className="mb-6 font-serif text-3xl font-bold text-primary sm:text-4xl">
        Checkout
      </h1>

      <Dialog open={showAddressPicker} onOpenChange={setShowAddressPicker}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Choose Delivery Address</DialogTitle>
          </DialogHeader>
          <RadioGroup value={pickerSelectedId} onValueChange={setPickerSelectedId} className="gap-3">
            {savedAddresses.map((addr) => (
              <label
                key={addr.id}
                htmlFor={`picker-${addr.id}`}
                className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition-colors ${
                  pickerSelectedId === addr.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border/60 hover:border-primary/40'
                }`}
              >
                <RadioGroupItem value={addr.id} id={`picker-${addr.id}`} className="mt-0.5" />
                <div>
                  <p className="font-medium">
                    {addr.full_name}
                    {addr.is_default ? (
                      <span className="ml-2 rounded bg-secondary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary">
                        Default
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">{addr.phone}</p>
                  <p className="text-xs text-muted-foreground">
                    {addr.line1}
                    {addr.line2 ? `, ${addr.line2}` : ''}, {addr.city}, {addr.state} -{' '}
                    {addr.pincode}
                  </p>
                </div>
              </label>
            ))}
            <label
              htmlFor="picker-new"
              className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm transition-colors ${
                pickerSelectedId === 'new'
                  ? 'border-primary bg-primary/5'
                  : 'border-border/60 hover:border-primary/40'
              }`}
            >
              <RadioGroupItem value="new" id="picker-new" />
              <span className="font-medium text-primary">+ Add a new address</span>
            </label>
          </RadioGroup>
          <div className="mt-2 flex items-center justify-between gap-3">
            <Button type="button" variant="outline" onClick={editPickerSelection}>
              Edit
            </Button>
            <Button type="button" className="bg-primary" onClick={confirmPickerSelection}>
              Select this address
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {appliedCoupon && couponDiscount > 0 && (
        <div className="mb-6 flex items-center gap-2 rounded-md border border-secondary/30 bg-secondary/10 px-4 py-3 text-sm font-medium text-secondary-foreground">
          <Tag className="h-4 w-4 shrink-0" />
          <span>
            You saved {formatINR(couponDiscount)} on this order with coupon{' '}
            <span className="font-semibold">{appliedCoupon.code}</span>!
          </span>
        </div>
      )}

      <form onSubmit={onSubmit} className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {hasSavedAddressSummary ? (
            <section className="rounded-lg border border-border/60 bg-card p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-serif text-lg font-bold text-primary">
                  Contact &amp; Shipping Address
                </h2>
                <button
                  type="button"
                  onClick={openAddressPicker}
                  className="shrink-0 rounded-md border border-secondary/60 px-3 py-1.5 text-sm font-medium text-secondary hover:bg-secondary/10"
                >
                  Choose Address
                </button>
              </div>
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-foreground">
                  {firstName} {lastName}
                </p>
                <p className="text-muted-foreground">{shipPhone}</p>
                <p className="text-muted-foreground">{email}</p>
                <p className="text-muted-foreground">
                  {addressLine1}
                  {addressLine2 ? `, ${addressLine2}` : ''}, {city}, {stateName} - {pincode}
                  {country ? `, ${country}` : ''}
                </p>
              </div>
            </section>
          ) : (
            <>
              {/* Contact */}
              <section className="rounded-lg border border-border/60 bg-card p-5">
                <h2 className="mb-4 font-serif text-lg font-bold text-primary">
                  Contact Information
                </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="firstName">First name *</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  required
                  placeholder="Aanya"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="lastName">Last name *</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  required
                  placeholder="Sharma"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="aanya@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setTrackingEmail(e.target.value);
                  }}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  placeholder="+91 98765 43210"
                  value={shipPhone}
                  onChange={(e) => setShipPhone(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Shipping */}
          <section className="mt-4 rounded-lg border border-border/60 bg-card p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-serif text-lg font-bold text-primary">Shipping Address</h2>
            </div>
            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="address">Street address *</Label>
                <Input
                  id="address"
                  name="address"
                  required
                  placeholder="12, MG Road, Apt 304"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="address2">Apartment, suite, etc. (optional)</Label>
                <Input
                  id="address2"
                  name="address2"
                  placeholder="Bandra West"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    name="city"
                    required
                    placeholder="Mumbai"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="state">State *</Label>
                  <Input
                    id="state"
                    name="state"
                    required
                    placeholder="Maharashtra"
                    value={stateName}
                    onChange={(e) => setStateName(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="pincode">PIN code *</Label>
                  <Input
                    id="pincode"
                    name="pincode"
                    required
                    placeholder="400050"
                    inputMode="numeric"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="country">Country *</Label>
                  <Input
                    id="country"
                    name="country"
                    required
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </section>
            </>
          )}

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
          </section>
        </div>

        {/* Summary */}
        <aside className="lg:col-span-1">
          <div className="sticky top-24 rounded-lg border border-border/60 bg-card p-5">
            <h2 className="font-serif text-lg font-bold text-primary">Order Summary</h2>
            <Separator className="my-4" />
            <ul className="flex max-h-72 flex-col gap-3 overflow-y-auto">
              {items.map((item) => {
                const isBumpItem = !!item.isBump;
                return (
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
                      {isBumpItem && (
                        <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                          {item.quantity}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col justify-center gap-1">
                      <p className="line-clamp-1 text-xs font-medium">
                        {item.product.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Size: {item.size}
                      </p>
                      {!isBumpItem && (
                        <div className="mt-0.5 flex items-center gap-2">
                          <button
                            type="button"
                            aria-label="Decrease quantity"
                            onClick={() => changeItemQuantity(item, -1)}
                            disabled={item.quantity <= 1}
                            className="flex h-5 w-5 items-center justify-center rounded border border-border/60 text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-4 text-center text-xs font-semibold">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label="Increase quantity"
                            onClick={() => changeItemQuantity(item, 1)}
                            disabled={item.quantity >= (item.product.stock_quantity ?? Infinity)}
                            className="flex h-5 w-5 items-center justify-center rounded border border-border/60 text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    <span className="self-center text-xs font-semibold">
                      {formatINR(item.product.price * item.quantity)}
                    </span>
                  </li>
                );
              })}
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

            {/* Gift card */}
            <Separator className="my-4" />
            <div>
              {appliedGiftCard ? (
                <div className="flex items-center justify-between rounded-md bg-secondary/10 px-3 py-2 text-sm">
                  <span className="flex items-center gap-1.5 font-medium text-secondary-foreground">
                    <Gift className="h-3.5 w-3.5" /> {appliedGiftCard.code} applied (-
                    {formatINR(clampedGiftCardDiscount)})
                  </span>
                  <button
                    type="button"
                    onClick={handleRemoveGiftCard}
                    aria-label="Remove gift card"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Apply gift card code"
                      value={giftCardInput}
                      onChange={(e) => setGiftCardInput(e.target.value)}
                      className="h-9"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 shrink-0"
                      disabled={applyingGiftCard || !giftCardInput.trim()}
                      onClick={handleApplyGiftCard}
                    >
                      {applyingGiftCard ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                    </Button>
                  </div>
                  {giftCardError && <p className="text-xs text-destructive">{giftCardError}</p>}
                </div>
              )}
            </div>

            {/* Loyalty points redeem */}
            {loyaltySettings.enabled && pointsBalance > 0 && (
              <>
                <Separator className="my-4" />
                <div className="rounded-md bg-muted/40 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <Sparkles className="h-3.5 w-3.5 text-secondary" />
                      Use reward points
                    </span>
                    <Switch
                      checked={redeemPoints}
                      disabled={!canRedeemPoints}
                      onCheckedChange={handleToggleRedeemPoints}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {canRedeemPoints
                      ? `You have ${pointsBalance} points (worth ${formatINR(
                          Math.round(pointsBalance * loyaltySettings.redeem_value_per_point)
                        )}).`
                      : `You have ${pointsBalance} points — minimum ${loyaltySettings.min_redeem_points} needed to redeem.`}
                  </p>
                  {redeemPoints && canRedeemPoints && (
                    <div className="mt-2 flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={maxRedeemablePoints}
                        value={pointsToRedeem}
                        onChange={(e) =>
                          setPointsToRedeem(
                            Math.max(0, Math.min(maxRedeemablePoints, Number(e.target.value) || 0))
                          )
                        }
                        className="h-9"
                      />
                      <span className="shrink-0 text-xs text-muted-foreground">
                        = -{formatINR(loyaltyDiscount)}
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}

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
              {clampedGiftCardDiscount > 0 && (
                <div className="flex justify-between text-secondary-foreground">
                  <span>Gift card ({appliedGiftCard?.code})</span>
                  <span>-{formatINR(clampedGiftCardDiscount)}</span>
                </div>
              )}
              {loyaltyDiscount > 0 && (
                <div className="flex justify-between text-secondary-foreground">
                  <span>Points redeemed ({pointsToRedeem})</span>
                  <span>-{formatINR(loyaltyDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span>{shipping === 0 ? 'FREE' : formatINR(shipping)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Tax ({shippingSettings.gst_rate_percent}% GST, included)
                </span>
                <span>{formatINR(tax)}</span>
              </div>
            </div>

            {bumpSettings.enabled && bumpProduct && !bumpInCart && (
              <div className="mt-4 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
                <p className="text-sm font-semibold text-primary">{bumpSettings.headline}</p>
                <label className="mt-2 flex cursor-pointer items-start gap-3">
                  <Checkbox
                    className="mt-1"
                    checked={bumpInCart}
                    onCheckedChange={(v) => toggleBump(v === true)}
                  />
                  <div className="relative h-14 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                    <Image
                      src={bumpProduct.images[0] || 'https://placehold.co/48x56?text=No+Image'}
                      alt={bumpProduct.name}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium leading-tight">{bumpProduct.name}</p>
                    <p className="mt-0.5 text-sm">
                      <span className="font-semibold text-primary">{formatINR(bumpPrice)}</span>
                      {bumpSettings.discount_percent > 0 && (
                        <span className="ml-1.5 text-xs text-muted-foreground line-through">
                          {formatINR(bumpProduct.price)}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {bumpSettings.subtext}
                    </p>
                  </div>
                </label>
              </div>
            )}

            <div className="mt-4 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox
                  className="mt-1"
                  checked={isResale}
                  onCheckedChange={(v) => handleResaleCheckboxChange(v === true)}
                />
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                    <Store className="h-4 w-4" /> Resell this product
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Placing this order for your own customer? Set your selling price and
                    we&apos;ll ship directly to them.
                  </p>
                </div>
              </label>

              {isResale && (
                <div className="mt-3 space-y-3 border-t border-dashed border-primary/30 pt-3">
                  <div className="flex items-center justify-between rounded-md bg-white/60 px-3 py-2 text-xs">
                    <span className="text-muted-foreground">Your cost price</span>
                    <span className="font-semibold">{formatINR(total)}</span>
                  </div>
                  <div>
                    <Label htmlFor="resale-price" className="text-xs">
                      Selling price for your customer (₹)
                    </Label>
                    <Input
                      id="resale-price"
                      type="number"
                      min={total}
                      value={resaleSellingPrice}
                      onChange={(e) => setResaleSellingPrice(e.target.value)}
                      className="mt-1 h-9 max-w-[140px]"
                    />
                    {resalePriceTooLow && (
                      <p className="mt-1 text-[11px] text-destructive">
                        Must be at least {formatINR(total)} (your cost).
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="resale-brand" className="text-xs">
                      Brand name (optional)
                    </Label>
                    <Input
                      id="resale-brand"
                      value={resaleBrandName}
                      onChange={(e) => setResaleBrandName(e.target.value)}
                      placeholder="Shown on your invoice, if you have one"
                      className="mt-1 h-9"
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-md bg-white/60 px-3 py-2">
                    <span className="text-xs text-muted-foreground">Your profit</span>
                    <span className="font-serif text-lg font-bold text-green-600">
                      +{formatINR(Math.max(0, resaleProfit))}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <AlertDialog open={showResaleLoginPrompt} onOpenChange={setShowResaleLoginPrompt}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Log in to resell this product</AlertDialogTitle>
                  <AlertDialogDescription>
                    Reselling needs an account so we can track your orders and profit for you.
                    Log in, or create a free account if you don&apos;t have one yet — your cart
                    will still be here.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setShowResaleLoginPrompt(false)}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={goToResaleSignup}
                    className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
                  >
                    Create Account
                  </AlertDialogAction>
                  <AlertDialogAction onClick={goToResaleLogin}>Log In</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={showResaleConfirm} onOpenChange={setShowResaleConfirm}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Mark this as a resale order?</AlertDialogTitle>
                  <AlertDialogDescription>
                    We&apos;ll ship directly to the customer you enter below. You&apos;ll set the
                    price your customer pays and we&apos;ll show your profit.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={confirmResaleNo}>No</AlertDialogCancel>
                  <AlertDialogAction onClick={confirmResaleYes}>Yes</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Separator className="my-4" />
            <div className="flex items-center justify-between">
              <span className="font-serif text-base font-semibold">Total</span>
              <span
                className={`font-serif text-xl font-bold ${isResale ? 'text-green-600' : 'text-primary'}`}
              >
                {formatINR(payableTotal)}
              </span>
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={placing || resalePriceTooLow || (isResale && resaleSellingPriceNum <= 0)}
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
                  Place Order (COD) — {formatINR(payableTotal)}
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Pay {formatINR(payableTotal)}
                </>
              )}
            </Button>
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              By placing your order, you agree to our Terms & Privacy Policy.
            </p>
            <TrustBadges />
          </div>
        </aside>
      </form>
    </div>
  );
}
