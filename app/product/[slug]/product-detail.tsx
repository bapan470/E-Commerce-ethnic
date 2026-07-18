'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Star,
  ShoppingBag,
  Minus,
  Plus,
  Truck,
  ShieldCheck,
  RefreshCw,
  ChevronRight,
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
import ReviewsSection from '@/components/product/reviews-section';
import PincodeChecker from '@/components/product/pincode-checker';
import VariantSwatches from '@/components/product/variant-swatches';
import ProductGallery from '@/components/product/product-gallery';
import MobileStickyCartBar from '@/components/product/mobile-sticky-cart-bar';
import RelatedProducts from '@/components/product/related-products';
import RecentlyViewedSection from '@/components/product/recently-viewed';
import NotifyMeForm from '@/components/product/notify-me-form';
import { addRecentlyViewed } from '@/lib/recently-viewed';
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

  useEffect(() => {
    if (baseProduct) addRecentlyViewed(baseProduct.id);
  }, [baseProduct]);

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

  const handleAddToCart = () => {
    if (!selectedSize) {
      toast.error('Please select a size');
      return;
    }
    addItem(product, selectedSize, quantity);
    toast.success(`${product.name} added to cart`);
  };

  return (
    <div className="container-boutique py-8 pb-24 md:pb-8">
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

      <RelatedProducts current={product} allProducts={products} />

      <RecentlyViewedSection excludeId={product.id} />

      <MobileStickyCartBar
        name={product.name}
        price={product.price}
        mrp={product.mrp}
        inStock={product.inStock}
        onAdd={handleAddToCart}
      />
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
        {product.inStock ? (
          <Button
            onClick={onAdd}
            size="lg"
            className="flex-1 gap-2 bg-primary text-base"
          >
            <ShoppingBag className="h-4 w-4" />
            Add to Cart
          </Button>
        ) : (
          <Button
            disabled
            size="lg"
            variant="outline"
            className="flex-1 gap-2 text-base"
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
