'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Star,
  ShoppingBag,
  Minus,
  Plus,
  Truck,
  ShieldCheck,
  RefreshCw,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  X,
} from 'lucide-react';
import { useProducts, useCart } from '@/lib/cart-context';
import { fetchProductBySlug } from '@/lib/products-api';
import { fetchVariantBySlug, ProductVariant, VariantWithSizes } from '@/lib/variants-api';
import { Product } from '@/lib/types';
import { formatINR, discountPct } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import ProductCard from '@/components/product-card';
import ReviewsSection from '@/components/product/reviews-section';
import PincodeChecker from '@/components/product/pincode-checker';
import VariantSwatches from '@/components/product/variant-swatches';
import { toast } from 'sonner';

export default function ProductDetail() {
  const params = useParams<{ slug: string }>();
  const { getBySlug, products, loading } = useProducts();
  const { addItem } = useCart();

  const fromContext = useMemo(
    () => getBySlug(params.slug),
    [params.slug, getBySlug]
  );

  const [directProduct, setDirectProduct] = useState<Product | null>(null);
  const [directLoading, setDirectLoading] = useState(false);
  const [variant, setVariant] = useState<VariantWithSizes | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

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

  // Switching colour never navigates — it just swaps state on the page
  // that's already mounted, so nothing reloads or re-fetches the product.
  // The thumbnail/price/colour change instantly using data we already have;
  // sizes (needed for stock accuracy) fill in a moment later in the background.
  const handleSelectVariant = (v: ProductVariant) => {
    setVariant((prev) => ({ ...v, sizes: prev?.slug === v.slug ? prev.sizes : [] }));
    window.history.replaceState(null, '', `/product/${v.slug}`);
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
    return {
      ...baseProduct,
      price: variant.price_override ?? baseProduct.price,
      images: variant.images.length > 0 ? variant.images : baseProduct.images,
      colors: [variant.color],
      sizes: variant.sizes.length > 0 ? variant.sizes.map((s) => s.size) : baseProduct.sizes,
    };
  }, [baseProduct, variant]);

  useEffect(() => {
    if (product) setSelectedSize(product.sizes[0] ?? null);
  }, [product]);

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

  const related = products
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  const discount = discountPct(product.price, product.mrp);

  const handleAddToCart = () => {
    if (!selectedSize) {
      toast.error('Please select a size');
      return;
    }
    addItem(product, selectedSize, quantity);
    toast.success(`${product.name} added to cart`);
  };

  return (
    <div className="container-boutique py-8">
      <nav className="mb-6 flex items-center gap-1 text-xs text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-primary">Home</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/shop" className="hover:text-primary">Shop</Link>
        <ChevronRight className="h-3 w-3" />
        <Link
          href={`/shop?category=${encodeURIComponent(product.category)}`}
          className="hover:text-primary"
        >
          {product.category}
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12 lg:items-start">
        <div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <div className="-mx-4 sm:mx-0">
            <ProductGallery images={product.images} alt={product.name} discount={discount} />
          </div>
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
          selectedSize={selectedSize}
          setSelectedSize={setSelectedSize}
          quantity={quantity}
          setQuantity={setQuantity}
          onAdd={handleAddToCart}
        />
      </div>

      <div className="mt-14">
        <Tabs defaultValue="description">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="description">Description</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="shipping">Shipping & Returns</TabsTrigger>
            <TabsTrigger value="reviews">Reviews ({product.reviews})</TabsTrigger>
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
              <li><strong className="text-foreground">In stock:</strong> {product.stock_quantity} units</li>
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

      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-5 font-serif text-2xl font-bold text-primary">
            You may also like
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ProductGallery({
  images,
  alt,
  discount,
}: {
  images: string[];
  alt: string;
  discount: number;
}) {
  const [active, setActive] = useState(0);
  const [zoomStyle, setZoomStyle] = useState<{ transformOrigin: string } | undefined>(undefined);
  const [isZooming, setIsZooming] = useState(false);
  // Only real mice/trackpads get the hover-zoom effect. Touch devices fire
  // synthetic mouseenter/mousemove/mouseleave events on tap, which was
  // toggling the scale(2) transform for a frame during swipes/taps — that's
  // the "image hilta hai" (image shaking/jumping) bug on mobile.
  const [canHover, setCanHover] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const mainRef = useRef<HTMLDivElement | null>(null);
  const thumbColRef = useRef<HTMLDivElement | null>(null);
  const valid = images.length > 0 ? images : ['https://placehold.co/800x1000?text=No+Image'];

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    setCanHover(mq.matches);
    const handler = (e: MediaQueryListEvent) => setCanHover(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // A colour switch swaps `images` in place (no remount), so make sure the
  // gallery snaps back to the first shot of the new set instead of showing
  // whatever index/scroll position was active for the previous colour.
  useEffect(() => {
    setActive(0);
    mainRef.current?.scrollTo({ left: 0 });
    setIsZooming(false);
  }, [images]);

  // Keep the active index in sync while the user swipes/scrolls through the
  // main image strip (mobile) instead of only reacting to thumbnail taps.
  const handleMainScroll = () => {
    const el = mainRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== active) setActive(idx);
  };

  const selectImage = (idx: number) => {
    setActive(idx);
    mainRef.current?.scrollTo({ left: idx * mainRef.current.clientWidth, behavior: 'smooth' });
  };

  const scrollThumbCol = (dir: 1 | -1) => {
    thumbColRef.current?.scrollBy({ top: dir * 96, behavior: 'smooth' });
  };

  const handleMouseEnter = () => {
    if (canHover) setIsZooming(true);
  };
  const handleMouseLeave = () => {
    if (canHover) setIsZooming(false);
  };
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canHover) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomStyle({ transformOrigin: `${x}% ${y}%` });
  };

  // Only jump into the full-screen lightbox on touch/mobile taps — desktop
  // already zooms in place on hover, matching the two references sent.
  const handleMainImageClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      setLightboxIndex(active);
      setLightboxOpen(true);
    }
  };

  useEffect(() => {
    if (!lightboxOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [lightboxOpen]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3">
        {/* Desktop: vertical thumbnail rail on the left with up/down paging */}
        {valid.length > 1 && (
          <div className="hidden w-16 flex-shrink-0 flex-col items-center gap-2 sm:flex">
            <div
              ref={thumbColRef}
              className="no-scrollbar flex max-h-[500px] w-full flex-col gap-3 overflow-y-auto"
            >
              {valid.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => selectImage(idx)}
                  className={`relative aspect-[4/5] w-full flex-shrink-0 overflow-hidden rounded-md border-2 transition-colors ${
                    active === idx
                      ? 'border-primary'
                      : 'border-border hover:border-primary/40'
                  }`}
                  aria-label={`View ${alt} image ${idx + 1}`}
                >
                  <Image
                    src={img}
                    alt={`${alt} - image ${idx + 1}`}
                    fill
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                    sizes="64px"
                    className="select-none object-cover"
                  />
                </button>
              ))}
            </div>
            {valid.length > 4 && (
              <div className="flex gap-2">
                <button
                  onClick={() => scrollThumbCol(-1)}
                  aria-label="Scroll thumbnails up"
                  className="rounded-full border border-border p-1 text-muted-foreground hover:border-primary/40 hover:text-primary"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => scrollThumbCol(1)}
                  aria-label="Scroll thumbnails down"
                  className="rounded-full border border-border p-1 text-muted-foreground hover:border-primary/40 hover:text-primary"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        <div className="relative flex-1">
          <div
            ref={mainRef}
            onScroll={handleMainScroll}
            onClick={handleMainImageClick}
            style={{ overscrollBehaviorX: 'contain', WebkitOverflowScrolling: 'touch' }}
            className="no-scrollbar flex aspect-[4/5] snap-x snap-mandatory overflow-x-auto scroll-smooth border border-border/60 bg-muted sm:rounded-xl"
          >
            {valid.map((img, idx) => {
              // Only mount the current slide + its immediate neighbours with a
              // real <Image>. The rest stay as empty placeholders (same size,
              // no request fired) until the user swipes near them. Without
              // this, every photo in the gallery started downloading the
              // moment the page opened, which is what was making mobile feel
              // slow to load.
              const isNear = Math.abs(idx - active) <= 1;
              return (
                <div
                  key={idx}
                  className="relative h-full w-full flex-none snap-center overflow-hidden bg-muted"
                  onMouseEnter={canHover ? handleMouseEnter : undefined}
                  onMouseLeave={canHover ? handleMouseLeave : undefined}
                  onMouseMove={canHover ? handleMouseMove : undefined}
                >
                  {isNear && (
                    <Image
                      src={img}
                      alt={`${alt} - image ${idx + 1}`}
                      fill
                      priority={idx === 0}
                      loading={idx === 0 ? undefined : 'lazy'}
                      draggable={false}
                      onDragStart={(e) => e.preventDefault()}
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      className={`select-none object-cover transition-transform duration-200 ease-out cursor-zoom-in ${
                        isZooming && active === idx ? 'scale-[2]' : 'scale-100'
                      }`}
                      style={active === idx ? zoomStyle : undefined}
                    />
                  )}
                </div>
              );
            })}
          </div>
          {discount > 0 && (
            <Badge className="absolute left-4 top-4 bg-secondary text-secondary-foreground">
              {discount}% OFF
            </Badge>
          )}
          {/* Mobile: dots only, no thumbnail strip — tap the image to open the full-screen zoom view */}
          {valid.length > 1 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5 sm:hidden">
              {valid.map((_, idx) => (
                <span
                  key={idx}
                  className={`h-1.5 rounded-full transition-all ${
                    active === idx ? 'w-4 bg-primary' : 'w-1.5 bg-white/80'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile full-screen zoom lightbox */}
      {lightboxOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white sm:hidden">
          <button
            onClick={() => setLightboxOpen(false)}
            aria-label="Close"
            className="absolute right-4 top-4 z-10 rounded-full bg-white/90 p-2 shadow-md"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex flex-1 items-center justify-center overflow-hidden p-4">
            <PinchZoomImage
              key={lightboxIndex}
              src={valid[lightboxIndex]}
              alt={`${alt} - image ${lightboxIndex + 1}`}
            />
          </div>
          {valid.length > 1 && (
            <div className="no-scrollbar flex gap-2 overflow-x-auto border-t border-border/60 p-3">
              {valid.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setLightboxIndex(idx)}
                  className={`relative h-16 w-14 flex-none overflow-hidden rounded-md border-2 ${
                    lightboxIndex === idx ? 'border-primary' : 'border-border'
                  }`}
                  aria-label={`View ${alt} image ${idx + 1}`}
                >
                  <Image src={img} alt="" fill draggable={false} onDragStart={(e) => e.preventDefault()} sizes="56px" className="select-none object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Full-screen zoom view: zooming happens directly via pinch (touch) or
// scroll/wheel (trackpad/mouse) — no tap needed first. Once zoomed in you
// can drag with one finger to pan around. Tapping just toggles a quick
// zoom in/out as a convenience shortcut; it's never required.
function PinchZoomImage({ src, alt }: { src: string; alt: string }) {
  const areaRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const translateRef = useRef({ x: 0, y: 0 });
  const pinchRef = useRef<{ startDist: number; startScale: number } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; startTx: number; startTy: number } | null>(null);
  const tapRef = useRef<{ x: number; y: number; time: number; moved: boolean } | null>(null);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);
  useEffect(() => {
    translateRef.current = translate;
  }, [translate]);

  const clampScale = (s: number) => Math.min(4, Math.max(1, s));

  const clampTranslate = (t: { x: number; y: number }, s: number, el: HTMLDivElement) => {
    const maxX = (el.clientWidth * (s - 1)) / 2;
    const maxY = (el.clientHeight * (s - 1)) / 2;
    return {
      x: Math.min(maxX, Math.max(-maxX, t.x)),
      y: Math.min(maxY, Math.max(-maxY, t.y)),
    };
  };

  const resetZoom = () => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  };

  // Attached as native (non-passive) listeners so preventDefault reliably
  // stops the page/lightbox from scrolling while pinching or panning —
  // React's onTouch* props are passive by default and can't block that.
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;

    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchRef.current = { startDist: dist(e.touches), startScale: scaleRef.current };
        panRef.current = null;
        tapRef.current = null;
      } else if (e.touches.length === 1) {
        const t = e.touches[0];
        tapRef.current = { x: t.clientX, y: t.clientY, time: Date.now(), moved: false };
        if (scaleRef.current > 1) {
          panRef.current = {
            startX: t.clientX,
            startY: t.clientY,
            startTx: translateRef.current.x,
            startTy: translateRef.current.y,
          };
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const ratio = dist(e.touches) / pinchRef.current.startDist;
        const next = clampScale(pinchRef.current.startScale * ratio);
        setScale(next);
        setTranslate((t) => clampTranslate(t, next, el));
      } else if (e.touches.length === 1 && panRef.current) {
        const t = e.touches[0];
        if (tapRef.current && Math.hypot(t.clientX - tapRef.current.x, t.clientY - tapRef.current.y) > 8) {
          tapRef.current.moved = true;
        }
        if (scaleRef.current > 1) {
          e.preventDefault();
          const dx = t.clientX - panRef.current.startX;
          const dy = t.clientY - panRef.current.startY;
          setTranslate(
            clampTranslate({ x: panRef.current.startTx + dx, y: panRef.current.startTy + dy }, scaleRef.current, el)
          );
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinchRef.current = null;
      if (e.touches.length === 0) {
        panRef.current = null;
        if (scaleRef.current < 1.05) resetZoom();
        // A quick, still tap (not a pinch/drag) toggles zoom as a shortcut —
        // scrolling/pinching is the primary way to zoom, this is optional.
        const tap = tapRef.current;
        if (tap && !tap.moved && Date.now() - tap.time < 300) {
          if (scaleRef.current > 1) {
            resetZoom();
          } else {
            const rect = el.getBoundingClientRect();
            setScale(2.5);
            setTranslate(
              clampTranslate(
                {
                  x: (rect.width / 2 - (tap.x - rect.left)) * 1.5,
                  y: (rect.height / 2 - (tap.y - rect.top)) * 1.5,
                },
                2.5,
                el
              )
            );
          }
        }
        tapRef.current = null;
      }
    };

    // Trackpad pinch and mouse-wheel scroll both zoom directly — no tap
    // needed. Trackpad pinch arrives as a wheel event with ctrlKey set.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const next = clampScale(scaleRef.current - e.deltaY * 0.01);
      setScale(next);
      setTranslate((t) => clampTranslate(t, next, el));
      if (next <= 1) setTranslate({ x: 0, y: 0 });
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('wheel', onWheel);
    };
  }, []);

  return (
    <div
      ref={areaRef}
      className={`relative h-full w-full touch-none select-none overflow-hidden ${
        scale > 1 ? 'cursor-grab' : ''
      }`}
    >
      <div
        className="relative h-full w-full"
        style={{
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          transition: 'transform 0.08s linear',
        }}
      >
        <Image
          src={src}
          alt={alt}
          fill
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          sizes="100vw"
          priority
          className="select-none object-contain"
        />
      </div>
    </div>
  );
}

function ProductInfo({
  product,
  selectedSize,
  setSelectedSize,
  quantity,
  setQuantity,
  onAdd,
}: {
  product: Product;
  selectedSize: string | null;
  setSelectedSize: (s: string) => void;
  quantity: number;
  setQuantity: (n: number | ((q: number) => number)) => void;
  onAdd: () => void;
}) {
  const discount = discountPct(product.price, product.mrp);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
          {product.category}
        </p>
        <h1 className="mt-1 font-serif text-3xl font-bold text-primary sm:text-4xl">
          {product.name}
        </h1>
        <div className="mt-2 flex items-center gap-2 text-sm">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`h-4 w-4 ${
                  i < Math.round(product.rating)
                    ? 'fill-secondary text-secondary'
                    : 'text-muted-foreground/40'
                }`}
              />
            ))}
          </div>
          <span className="font-medium">{product.rating.toFixed(1)}</span>
          <span className="text-muted-foreground">&middot;</span>
          <span className="text-muted-foreground">{product.reviews} reviews</span>
        </div>
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

      <p className="text-sm leading-relaxed text-foreground/80">
        {product.description}
      </p>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Fabric</p>
          <p className="mt-0.5 font-medium">{product.fabric}</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Origin</p>
          <p className="mt-0.5 font-medium">{product.origin}</p>
        </div>
      </div>

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

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-md border border-border">
          <button
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="p-3 text-muted-foreground hover:text-primary"
            aria-label="Decrease quantity"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-10 text-center text-sm font-semibold">{quantity}</span>
          <button
            onClick={() => setQuantity((q) => q + 1)}
            className="p-3 text-muted-foreground hover:text-primary"
            aria-label="Increase quantity"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <Button
          onClick={onAdd}
          disabled={!product.inStock}
          size="lg"
          className="flex-1 gap-2 bg-primary text-base"
        >
          <ShoppingBag className="h-4 w-4" />
          {product.inStock ? 'Add to Cart' : 'Out of Stock'}
        </Button>
      </div>

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
