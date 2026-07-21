'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Star,
  ShoppingBag,
  Truck,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { useProducts, useCart } from '@/lib/cart-context';
import { fetchProductBySlug } from '@/lib/products-api';
import { fetchVariantBySlug, fetchVariantsForProduct, ProductVariant, VariantWithSizes } from '@/lib/variants-api';
import { Product } from '@/lib/types';
import { formatINR, discountPct } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import ReviewsSection from '@/components/product/reviews-section';
import { fetchApprovedReviews, summarizeReviews, RatingSummary } from '@/lib/reviews-api';
import PincodeChecker from '@/components/product/pincode-checker';
import VariantSwatches from '@/components/product/variant-swatches';
import ProductHighlights from '@/components/product/product-highlights';
import ProductGallery from '@/components/product/product-gallery';
import ProductVideo from '@/components/product/product-video';
import MobileStickyCartBar from '@/components/product/mobile-sticky-cart-bar';
import RelatedProducts from '@/components/product/related-products';
import RecentlyViewedSection from '@/components/product/recently-viewed';
import NotifyMeForm from '@/components/product/notify-me-form';
import LowStockBadge from '@/components/growth/low-stock-badge';
import CouponList from '@/components/product/coupon-list';
import WishlistButton from '@/components/wishlist-button';
import ShareButton from '@/components/share-button';
import { Coupon, validateCoupon } from '@/lib/coupons-api';
import FrequentlyBoughtTogether from '@/components/product/frequently-bought-together';
import { addRecentlyViewed } from '@/lib/recently-viewed';
import { trackEvent } from '@/lib/track-api';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import { markCheckoutEntry } from '@/lib/checkout-return';

// Coupon "preview" applied on a product page before Add to Cart. Persisted
// so it survives a page reload, or a trip to another product and back —
// mirrors how the real cart coupon is persisted in lib/cart-context.tsx.
const PRODUCT_COUPON_PREVIEW_KEY = 'saaj-product-coupon-preview-v1';

export default function ProductDetail() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const { getBySlug, products, loading } = useProducts();
  const { addItem, startBuyNow, subtotal: cartSubtotal, applyCoupon: applyCartCoupon } = useCart();
  const { user } = useAuth();

  const fromContext = useMemo(
    () => getBySlug(params.slug),
    [params.slug, getBySlug]
  );

  const [directProduct, setDirectProduct] = useState<Product | null>(null);
  const [directLoading, setDirectLoading] = useState(false);
  const [variant, setVariant] = useState<VariantWithSizes | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('reviews');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponHydrated, setCouponHydrated] = useState(false);
  // Code the shopper applied here on the product page, waiting to be synced
  // into the shared cart coupon (lib/cart-context.tsx) once Add to Cart is
  // clicked and the item — and therefore the real cart subtotal — exists.
  const [pendingCouponCode, setPendingCouponCode] = useState<string | null>(null);
  // Guards handleBuyNow (defined below) against a fast double-tap firing
  // it twice — declared up here with the other hooks since this component
  // has early returns further down while data is still loading.
  const buyNowNavigatingRef = useRef(false);

  // The URL slug might belong either to a base product or to one of its
  // colour variants (independent SEO pages). Try the product table first;
  // if nothing matches, fall back to a variant lookup.
  useEffect(() => {
    if (fromContext) {
      setVariant(null);
      return;
    }
    let cancelled = false;
    setDirectLoading(true);
    fetchProductBySlug(params.slug)
      .then((p) => {
        if (cancelled) return;
        if (p) {
          setDirectProduct(p);
          setVariant(null);
          return;
        }
        return fetchVariantBySlug(params.slug).then((res) => {
          if (cancelled || !res) return;
          setDirectProduct(res.product);
          setVariant(res.variant);
        });
      })
      .catch(() => setDirectProduct(null))
      .finally(() => !cancelled && setDirectLoading(false));
    return () => {
      cancelled = true;
    };
  }, [fromContext, params.slug]);

  const baseProduct = fromContext ?? directProduct;
  const isLoading = loading || directLoading;

  // Live rating/review split for this product -- a star-only submission
  // (no title/comment) counts toward `totalRatings` but NOT `totalReviews`.
  // Falls back to the admin-set seed numbers (product.rating / product.reviews)
  // until the product has at least one real approved rating, so brand-new
  // listings still show their seeded social-proof numbers.
  const [liveSummary, setLiveSummary] = useState<RatingSummary | null>(null);
  useEffect(() => {
    if (!baseProduct?.id) {
      setLiveSummary(null);
      return;
    }
    let cancelled = false;
    fetchApprovedReviews(baseProduct.id)
      .then((reviews) => {
        if (!cancelled) setLiveSummary(summarizeReviews(reviews));
      })
      .catch(() => {
        if (!cancelled) setLiveSummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, [baseProduct?.id]);

  const displayRating = liveSummary && liveSummary.totalRatings > 0 ? liveSummary.average : baseProduct?.rating ?? 0;
  const displayRatingsCount = liveSummary && liveSummary.totalRatings > 0 ? liveSummary.totalRatings : baseProduct?.reviews ?? 0;
  const displayReviewsCount = liveSummary && liveSummary.totalRatings > 0 ? liveSummary.totalReviews : baseProduct?.reviews ?? 0;

  // If the URL is the base product's own slug (not a colour's dedicated
  // SEO page) and that product has colour variants, silently switch to its
  // default colour on load -- same variant that shop/category cards show
  // and link to, so opening the product any way always lands on the same
  // colour. Uses replaceState (like handleSelectVariant below) so it
  // doesn't add a back-button entry or trigger a full reload.
  const defaultVariantAppliedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!baseProduct) return;
    if (variant) return;
    if (params.slug !== baseProduct.slug) return;
    if (defaultVariantAppliedForRef.current === baseProduct.id) return;
    defaultVariantAppliedForRef.current = baseProduct.id;
    let cancelled = false;
    fetchVariantsForProduct(baseProduct.id)
      .then((variants) => {
        if (cancelled || variants.length === 0) return;
        const def = variants.find((v) => v.is_default) ?? variants[0];
        return fetchVariantBySlug(def.slug).then((res) => {
          if (cancelled || !res) return;
          setVariant(res.variant);
          window.history.replaceState(window.history.state, '', `/product/${def.slug}`);
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [baseProduct, variant, params.slug]);

  // Switching colour never navigates — it just swaps state on the page
  // that's already mounted, so nothing reloads or re-fetches the product.
  // The thumbnail/price/colour change instantly using data we already have;
  // sizes (needed for stock accuracy) fill in a moment later in the background.
  const handleSelectVariant = (v: ProductVariant) => {
    setVariant((prev) => ({ ...v, sizes: prev?.slug === v.slug ? prev.sizes : [] }));
    // Pass the EXISTING history.state through instead of null. Next.js's App
    // Router attaches its own internal navigation data to each history
    // entry's state object; wiping it with null here desyncs the router
    // from the real browser history stack. That desync is what made the
    // hardware/edge-swipe back gesture need two tries to leave checkout on
    // a colour-variant page — the first swipe only updated the URL bar
    // (browser-level), the second was needed for Next's router to actually
    // notice and re-render. Keeping the state object intact and only
    // swapping the URL avoids that entirely.
    window.history.replaceState(window.history.state, '', `/product/${v.slug}`);
    fetchVariantBySlug(v.slug)
      .then((res) => {
        if (res) setVariant(res.variant);
      })
      .catch(() => {});
  };

  // Merge variant overrides (colour, images, price) onto the base product
  // so the rest of the page can just render `product` as usual.
  const product = useMemo(() => {
    if (!baseProduct) return null;
    if (!variant) return baseProduct;
    // Sizes load in shortly after the swatch swap (see handleSelectVariant),
    // so while variant.sizes is still empty we fall back to the base
    // product's own stock figures rather than flashing "out of stock".
    const hasSizeData = variant.sizes.length > 0;
    const variantStockQty = variant.sizes.reduce((sum, s) => sum + s.stock_quantity, 0);
    return {
      ...baseProduct,
      price: variant.price_override ?? baseProduct.price,
      images: variant.images.length > 0 ? variant.images : baseProduct.images,
      video_url: variant.video || baseProduct.video_url,
      colors: [variant.color],
      sizes: hasSizeData ? variant.sizes.map((s) => s.size) : baseProduct.sizes,
      stock_quantity: hasSizeData ? variantStockQty : baseProduct.stock_quantity,
      inStock: hasSizeData ? variantStockQty > 0 : baseProduct.inStock,
    };
  }, [baseProduct, variant]);

  useEffect(() => {
    if (product) setSelectedSize(product.sizes[0] ?? null);
  }, [product]);

  // The `product` object above intentionally keeps an aggregate stock
  // figure (sum across all sizes of the current colour) so switching size
  // doesn't change its identity and re-trigger the effect above. But once a
  // specific size is chosen, the number that actually matters — for the
  // "only N left" message, the Add to Cart/Buy Now guard, and (via the
  // product object handed to addItem/startBuyNow below) the checkout page's
  // own +/- stepper — is that size's own stock, not the whole colour's.
  // Using the aggregate there was letting a shopper "select" quantities
  // the specific size didn't actually have, or blocking valid ones.
  const selectedSizeStock = useMemo(() => {
    if (!variant || variant.sizes.length === 0) {
      return product?.stock_quantity ?? Infinity;
    }
    const match = variant.sizes.find((s) => s.size === selectedSize);
    return match ? match.stock_quantity : 0;
  }, [variant, selectedSize, product]);

  // Restore a previously-applied coupon preview for this product (or the
  // current colour variant's price) whenever the product changes — this
  // fires on first load too, so a reload restores it, and it re-runs when
  // navigating to another product and back. We reset to "no coupon" first
  // so a moment mid-navigation never shows the PREVIOUS product's coupon
  // on the new one, then re-validate the stored code (min order value,
  // expiry, active status) against this product's actual price before
  // showing it as applied again.
  useEffect(() => {
    if (!product) return;
    let cancelled = false;
    setAppliedCoupon(null);
    setCouponDiscount(0);
    setCouponHydrated(false);

    let storedCode: string | null = null;
    try {
      storedCode = localStorage.getItem(PRODUCT_COUPON_PREVIEW_KEY);
    } catch {
      storedCode = null;
    }
    if (!storedCode) {
      setCouponHydrated(true);
      return;
    }
    validateCoupon(storedCode, product.price)
      .then((result) => {
        if (cancelled) return;
        if (result.ok && result.coupon) {
          setAppliedCoupon(result.coupon);
          setCouponDiscount(result.discount || 0);
        }
        // If it's no longer valid for this product (e.g. below min order
        // value), we simply leave it un-applied; the persist effect below
        // clears the stale code from storage once couponHydrated flips.
      })
      .finally(() => {
        if (!cancelled) setCouponHydrated(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id, product?.price]);

  // Keep localStorage in sync with the current preview coupon so it can be
  // restored later. Gated on couponHydrated so this never fires with the
  // initial `null` before the restore effect above has had a chance to run
  // — otherwise it would wipe a just-read stored code before it's used.
  useEffect(() => {
    if (!couponHydrated) return;
    try {
      if (appliedCoupon) {
        localStorage.setItem(PRODUCT_COUPON_PREVIEW_KEY, appliedCoupon.code);
      } else {
        localStorage.removeItem(PRODUCT_COUPON_PREVIEW_KEY);
      }
    } catch {
      // ignore
    }
  }, [appliedCoupon, couponHydrated]);

  useEffect(() => {
    if (baseProduct) addRecentlyViewed(baseProduct.id);
  }, [baseProduct]);

  useEffect(() => {
    if (baseProduct) {
      trackEvent('product_view', { productId: baseProduct.id, userId: user?.id ?? null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseProduct?.id]);

  // Once an item has been added to the cart with a coupon previewed on this
  // page, sync that coupon into the shared cart (lib/cart-context.tsx) so it
  // actually applies and shows up in the cart drawer, cart page & checkout.
  // Waiting on cartSubtotal ensures we validate against the subtotal that
  // already includes the item just added.
  useEffect(() => {
    if (!pendingCouponCode) return;
    applyCartCoupon(pendingCouponCode).then((result) => {
      if (!result.ok) {
        toast.error(result.error || 'Could not apply this coupon to your order');
      }
      setPendingCouponCode(null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCouponCode, cartSubtotal]);

  if (isLoading && !product) {
    return (
      <div className="container-boutique py-8">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <Skeleton className="aspect-[4/5] rounded-xl" />
          <div className="flex flex-col gap-4">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!product || !baseProduct) {
    return (
      <div className="container-boutique flex flex-col items-center gap-4 py-24 text-center">
        <h1 className="font-serif text-2xl font-bold text-primary">Product not found</h1>
        <p className="text-sm text-muted-foreground">
          The product you are looking for does not exist or has been removed.
        </p>
        <Button asChild className="bg-primary">
          <Link href="/shop">Back to Shop</Link>
        </Button>
      </div>
    );
  }

  const discount = discountPct(product.price, product.mrp);

  const goToReviews = () => {
    setActiveTab('reviews');
    document.getElementById('product-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleAddToCart = () => {
    if (!selectedSize) {
      toast.error('Please select a size');
      return;
    }
    if (selectedSizeStock <= 0) {
      toast.error('Out of stock');
      return;
    }
    const cartProduct = { ...product, stock_quantity: selectedSizeStock, inStock: selectedSizeStock > 0 };
    addItem(cartProduct, selectedSize, quantity);
    if (appliedCoupon) {
      // Carry the coupon previewed on this page into the real cart so it
      // shows up (and actually applies) in the cart drawer, cart page and
      // checkout too — see effect above, which fires once the cart
      // subtotal reflects this item.
      setPendingCouponCode(appliedCoupon.code);
    }
    trackEvent('add_to_cart', {
      productId: product.id,
      userId: user?.id ?? null,
      metadata: { size: selectedSize, quantity, color: product.colors?.[0] ?? null },
    });
  };

  const handleBuyNow = () => {
    if (!selectedSize) {
      toast.error('Please select a size');
      return;
    }
    if (selectedSizeStock <= 0) {
      toast.error('Out of stock');
      return;
    }
    // Guard against a fast double-tap firing this twice — that would push
    // /checkout onto history twice, and the back button would then need
    // an extra click to actually leave the checkout page.
    if (buyNowNavigatingRef.current) return;
    buyNowNavigatingRef.current = true;
    const cartProduct = { ...product, stock_quantity: selectedSizeStock, inStock: selectedSizeStock > 0 };
    startBuyNow(cartProduct, selectedSize, quantity);
    if (appliedCoupon) {
      applyCartCoupon(appliedCoupon.code, product.price * quantity, 1).then((result) => {
        if (!result.ok) {
          toast.error(result.error || 'Could not apply this coupon to your order');
        }
      });
    }
    trackEvent('add_to_cart', {
      productId: product.id,
      userId: user?.id ?? null,
      metadata: { size: selectedSize, quantity, color: product.colors?.[0] ?? null, via: 'buy_now' },
    });
    markCheckoutEntry({ fromBuyNow: true });
    router.push('/checkout');
  };

  return (
    <div className="container-boutique pt-0 pb-24 sm:pt-4 md:pb-8">
      <div className="grid gap-4 lg:grid-cols-2 lg:gap-8 lg:items-start">
        <div className="flex flex-col gap-3 lg:sticky lg:top-24 lg:self-start">
          <div className="-mx-4 sm:mx-0">
            <ProductGallery images={product.images} alt={product.name} discount={discount} />
          </div>
          {product.video_url && (
            <div className="px-4 sm:px-0">
              <ProductVideo
                videoUrl={product.video_url}
                posterUrl={product.images[0]}
                alt={product.name}
              />
            </div>
          )}
          <div className="px-4 sm:px-0">
            <VariantSwatches
              productId={baseProduct.id}
              activeSlug={variant?.slug}
              onSelect={handleSelectVariant}
            />
          </div>
        </div>
        <ProductInfo
          product={product}
          displayRating={displayRating}
          displayRatingsCount={displayRatingsCount}
          displayReviewsCount={displayReviewsCount}
          selectedSize={selectedSize}
          setSelectedSize={setSelectedSize}
          selectedSizeStock={selectedSizeStock}
          quantity={quantity}
          setQuantity={setQuantity}
          onAdd={handleAddToCart}
          onReviewsClick={goToReviews}
          appliedCoupon={appliedCoupon}
          couponDiscount={couponDiscount}
          onCouponApply={(c, d) => {
            setAppliedCoupon(c);
            setCouponDiscount(d);
          }}
          onCouponRemove={() => {
            setAppliedCoupon(null);
            setCouponDiscount(0);
          }}
        />
      </div>

      <div id="product-tabs" className="mt-8 scroll-mt-24">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start">
            <TabsTrigger value="reviews">Reviews ({displayRatingsCount})</TabsTrigger>
            <TabsTrigger value="description">Description</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="shipping">Shipping & Returns</TabsTrigger>
          </TabsList>
          <TabsContent value="description" className="max-w-3xl text-sm leading-relaxed text-foreground/80">
            <p>{product.description}</p>
            <p className="mt-3">
              Each piece is handcrafted by skilled artisans, carrying forward
              centuries of weaving tradition. Subtle variations in motif and
              colour are a hallmark of genuine handloom and make every piece
              uniquely yours.
            </p>
          </TabsContent>
          <TabsContent value="details" className="max-w-3xl text-sm">
            <ul className="grid gap-2 sm:grid-cols-2">
              <li><strong className="text-foreground">Fabric:</strong> {product.fabric}</li>
              <li><strong className="text-foreground">Origin:</strong> {product.origin}</li>
              <li><strong className="text-foreground">Category:</strong> {product.category}</li>
              <li><strong className="text-foreground">Colors:</strong> {product.colors.join(', ')}</li>
              <li><strong className="text-foreground">Sizes:</strong> {product.sizes.join(', ')}</li>
              <li><strong className="text-foreground">Care:</strong> Dry clean only</li>
              <li><strong className="text-foreground">In stock:</strong> {selectedSizeStock} units</li>
              {(variant?.sku || product.sku) && (
                <li><strong className="text-foreground">SKU:</strong> {variant?.sku || product.sku}</li>
              )}
            </ul>
          </TabsContent>
          <TabsContent value="shipping" className="max-w-3xl text-sm leading-relaxed text-foreground/80">
            <p>Free shipping on all orders above Rs 2,000. Dispatched within 2-3 business days. 7-day easy returns on unworn items with original packaging.</p>
          </TabsContent>
          <TabsContent value="reviews">
            <ReviewsSection productId={baseProduct.id} productSlug={baseProduct.slug} />
          </TabsContent>
        </Tabs>
      </div>

      <FrequentlyBoughtTogether productId={baseProduct.id} />

      <RelatedProducts current={product} allProducts={products} />

      <RecentlyViewedSection excludeId={product.id} />

      <MobileStickyCartBar
        name={product.name}
        price={product.price}
        mrp={product.mrp}
        inStock={selectedSizeStock > 0}
        onAdd={handleAddToCart}
        onBuyNow={handleBuyNow}
        couponCode={appliedCoupon?.code ?? null}
        couponDiscount={couponDiscount}
      />
    </div>
  );
}


function ProductInfo({
  product,
  displayRating,
  displayRatingsCount,
  displayReviewsCount,
  selectedSize,
  setSelectedSize,
  selectedSizeStock,
  quantity,
  setQuantity,
  onAdd,
  onReviewsClick,
  appliedCoupon,
  couponDiscount,
  onCouponApply,
  onCouponRemove,
}: {
  product: Product;
  displayRating: number;
  displayRatingsCount: number;
  displayReviewsCount: number;
  selectedSize: string | null;
  setSelectedSize: (s: string) => void;
  selectedSizeStock: number;
  quantity: number;
  setQuantity: (n: number | ((q: number) => number)) => void;
  onAdd: () => void;
  onReviewsClick: () => void;
  appliedCoupon: Coupon | null;
  couponDiscount: number;
  onCouponApply: (coupon: Coupon, discount: number) => void;
  onCouponRemove: () => void;
}) {
  const discount = discountPct(product.price, product.mrp);
  const [descExpanded, setDescExpanded] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
              {product.category}
            </p>
            <h1 className="mt-1 font-serif text-base font-bold text-primary sm:text-xl">
              {product.name}
            </h1>
          </div>
          <div className="flex shrink-0 items-start gap-4 pt-1">
            <WishlistButton productId={product.id} showLabel />
            <ShareButton title={product.name} text={`Check out ${product.name} on Aruhi`} />
          </div>
        </div>
        <button
          type="button"
          onClick={onReviewsClick}
          className="mt-2 flex items-center gap-2 text-sm hover:underline"
        >
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`h-4 w-4 ${
                  i < Math.round(displayRating)
                    ? 'fill-secondary text-secondary'
                    : 'text-muted-foreground/40'
                }`}
              />
            ))}
          </div>
          <span className="font-medium">{displayRating.toFixed(1)}</span>
          <span className="text-muted-foreground">&middot;</span>
          <span className="text-muted-foreground">
            {displayRatingsCount} rating{displayRatingsCount === 1 ? '' : 's'}
            {displayReviewsCount > 0 ? ` \u00b7 ${displayReviewsCount} review${displayReviewsCount === 1 ? '' : 's'}` : ''}
          </span>
        </button>
      </div>

      <div className="flex items-baseline gap-3">
        <span className="font-serif text-3xl font-bold text-primary">
          {formatINR(product.price)}
        </span>
        {product.mrp && product.mrp > product.price && (
          <>
            <span className="text-base text-muted-foreground line-through">
              {formatINR(product.mrp)}
            </span>
            <Badge className="bg-secondary/20 text-secondary-foreground">
              Save {formatINR(product.mrp - product.price)}
            </Badge>
          </>
        )}
      </div>

      {appliedCoupon && (
        <p className="-mt-3 font-serif text-xl font-bold text-green-600">
          {formatINR(Math.max(0, product.price - couponDiscount))}{' '}
          <span className="text-xs font-normal">
            after coupon &quot;{appliedCoupon.code}&quot;
          </span>
        </p>
      )}

      <CouponList
        productPrice={product.price}
        appliedCode={appliedCoupon?.code ?? null}
        onApply={onCouponApply}
        onRemove={onCouponRemove}
      />

      <LowStockBadge stockQuantity={selectedSizeStock} />

      <div>
        <p
          className={`text-sm leading-relaxed text-foreground/80 ${
            descExpanded ? '' : 'line-clamp-2'
          }`}
        >
          {product.description}
        </p>
        <button
          type="button"
          onClick={() => setDescExpanded((v) => !v)}
          className="mt-1 text-sm font-medium text-primary hover:underline"
        >
          {descExpanded ? 'Show less' : 'Show more'}
        </button>
      </div>

      <ProductHighlights product={product} />

      {product.sizes.length > 1 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Select Size</p>
            <button className="text-xs text-primary underline">Size guide</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {product.sizes.map((s) => (
              <button
                key={s}
                onClick={() => setSelectedSize(s)}
                className={`min-w-[3rem] rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                  selectedSize === s
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background hover:border-primary/50'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {quantity >= selectedSizeStock && selectedSizeStock > 0 && (
          <p className="w-full text-xs text-muted-foreground">
            Only {selectedSizeStock} unit{selectedSizeStock > 1 ? 's' : ''} left in stock.
          </p>
        )}
        {selectedSizeStock > 0 ? (
          <Button
            onClick={onAdd}
            size="lg"
            className="hidden flex-1 gap-2 bg-primary text-base md:flex"
          >
            <ShoppingBag className="h-4 w-4" />
            Add to Bag
          </Button>
        ) : (
          <Button
            disabled
            size="lg"
            variant="outline"
            className="hidden flex-1 gap-2 text-base md:flex"
          >
            Out of Stock
          </Button>
        )}
      </div>

      {!product.inStock && <NotifyMeForm productId={product.id} />}

      <PincodeChecker />

      <div className="grid grid-cols-3 gap-3 rounded-lg border border-border/60 bg-card p-4 text-center">
        {[
          { icon: Truck, label: 'Free Shipping' },
          { icon: ShieldCheck, label: 'Authentic' },
          { icon: RefreshCw, label: '7-day Returns' },
        ].map((a) => (
          <div key={a.label} className="flex flex-col items-center gap-1">
            <a.icon className="h-5 w-5 text-secondary" />
            <span className="text-[11px] font-medium">{a.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
