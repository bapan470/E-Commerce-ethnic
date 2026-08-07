'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingBag, Star } from 'lucide-react';
import { Product } from '@/lib/types';
import { formatINR, discountPct } from '@/lib/format';
import { getVariantDisplayName } from '@/lib/variant-display-name';
import { useCart, getVisibleBogoPromotion, formatBogoLabel } from '@/lib/cart-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import WishlistButton from '@/components/wishlist-button';
import CatalogCardMedia from '@/components/catalog-card-media';
import { toPublicMediaUrl } from '@/lib/media-url';
import { Truck } from 'lucide-react';

export default function ProductCard({
  product,
  priority = false,
  compact = false,
  imageOverride,
  slugOverride,
}: {
  product: Product;
  /** Set true for cards in the first visible row so their image gets
   *  preloaded instead of lazy-loaded — improves LCP on the shop/home grid. */
  priority?: boolean;
  /** Smaller padding/type for horizontal carousels (Similar Products,
   *  Recently Viewed) where cards sit in a narrower, scrollable strip. */
  compact?: boolean;
  /**
   * Used by "search by photo" results: the exact photo (which may be a
   * colour variant's photo, not the product's default image) that actually
   * matched the shopper's uploaded photo. When present it takes priority
   * over the product's own default/first image, so a shopper who searched
   * with a photo of the "blue" variant sees that blue photo on the card
   * instead of whatever colour happens to be the product's default.
   */
  imageOverride?: string;
  /** When a search query matches a specific colour variant, pass that
   *  variant's slug so the card links directly to that colour. */
  slugOverride?: string;
}) {
  const { addItem, activePromotions } = useCart();
  const router = useRouter();

  // Part 4b: tag products currently inside an active BOGO promotion's
  // scope, same "is this product in scope" rule the cart itself uses to
  // apply the discount (see getVisibleBogoPromotion in
  // lib/cart-context.tsx) — so the badge and the actual discount never
  // disagree about which products are on offer. Also respects the
  // per-collection "show BOGO badge" toggle (Admin > Collections).
  const bogoPromotion = getVisibleBogoPromotion(product.id, activePromotions);

  const quickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const size = product.sizes[0];
    addItem(product, size, 1);
  };

  // The category and collection labels sit inside the card's outer <Link>,
  // so a nested <a> isn't valid HTML -- instead these stop the click from
  // bubbling to the card link and navigate imperatively themselves.
  const goToCategory = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/shop?category=${encodeURIComponent(product.category)}`);
  };
  const goToCollection = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (product.collection) router.push(`/collection/${product.collection.slug}`);
  };

  const discount = discountPct(product.price, product.mrp);
  // When this product has colour variants, the card should show and link to
  // the default one -- shoppers land straight on that colour, and clicking
  // through from shop/category always opens that exact variant.
  const href = `/product/${slugOverride || product.default_variant_slug || product.slug}`;
  const img = toPublicMediaUrl(
    imageOverride || product.default_variant_image || product.images[0]
  ) || 'https://placehold.co/800x1000?text=No+Image';
  const hoverImg = toPublicMediaUrl(product.images[1]) || undefined;
  // The card's photo (`img` above) can be the default variant's photo,
  // which may be a different colour than the base product's own name/first
  // photo (e.g. base "Maroon Handloom Kurti" with a "Blue" default variant).
  // Swap the base colour for the variant's colour the same way the product
  // detail page does, so the name/alt text shown always matches the photo
  // actually on screen instead of contradicting it.
  const displayName = getVariantDisplayName(product.name, product.colors?.[0], product.default_variant_color);
  const altText = `${displayName} - ${product.fabric} ${product.category} from ${product.origin}`;

  return (
    <Link
      href={href}
      className="group relative flex flex-col overflow-hidden rounded-2xl bg-card shadow-sm transition-shadow duration-300 hover:shadow-lg product-card-hover"
    >
      <div className="relative overflow-hidden">
        <CatalogCardMedia
          img={img}
          hoverImg={hoverImg}
          altText={altText}
          videoUrl={toPublicMediaUrl(product.video_url) || undefined}
          autoplayVideo={!!product.autoplay_video_in_catalog}
          priority={priority}
          compact={compact}
        />
        <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {/* Admin toggles "Featured" per product in the dashboard — shown
              here as a Bestseller tag, so it updates the moment they flip it. */}
          {product.featured && (
            <Badge className="bg-emerald-600 text-white shadow-sm hover:bg-emerald-600">
              Bestseller
            </Badge>
          )}
          {discount > 0 && (
            <Badge className="border-transparent bg-rose-500 text-white shadow-sm hover:bg-rose-500">
              {discount}% OFF
            </Badge>
          )}
          {bogoPromotion && (
            <Badge className="border-transparent bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary">
              {formatBogoLabel(bogoPromotion)}
            </Badge>
          )}
        </div>
        <WishlistButton productId={product.id} className="absolute right-3 top-3" />
        {!product.inStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60">
            <span className="rounded bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary-foreground">
              Out of Stock
            </span>
          </div>
        )}
        <Button
          onClick={quickAdd}
          disabled={!product.inStock}
          size="sm"
          className="absolute bottom-3 right-3 hidden gap-1 rounded-full bg-primary/95 opacity-0 shadow-md transition-all duration-300 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 hover:bg-primary sm:flex"
          aria-label="Add to bag"
        >
          <ShoppingBag className="h-4 w-4" />
          Add
        </Button>
      </div>

      <div className={`flex flex-1 flex-col gap-1 ${compact ? 'p-2.5' : 'p-4'}`}>
        <div className="flex flex-col gap-0.5">
          <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] font-semibold uppercase tracking-wider text-secondary">
            <span
              onClick={goToCategory}
              className="cursor-pointer hover:underline"
            >
              {product.category}
            </span>
            {product.collection && (
              <>
                <span className="text-secondary/40">·</span>
                <span
                  onClick={goToCollection}
                  className="cursor-pointer text-foreground/60 hover:underline"
                >
                  {product.collection.name}
                </span>
              </>
            )}
          </p>
          <span className="flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
            <Truck className="h-3 w-3" />
            Free Delivery
          </span>
        </div>
        <h3 className={`line-clamp-2 font-serif font-semibold leading-snug text-foreground ${compact ? 'text-xs' : 'text-sm'}`}>
          {displayName}
        </h3>
        {product.reviews > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="h-3 w-3 fill-secondary text-secondary" />
            <span>{product.rating.toFixed(1)}</span>
            <span>·</span>
            <span>{product.reviews} reviews</span>
          </div>
        )}
        <div className="mt-1 flex items-baseline gap-2">
          <span className={`font-serif font-bold text-primary ${compact ? 'text-sm' : 'text-base'}`}>
            {formatINR(product.price)}
          </span>
          {product.mrp && product.mrp > product.price && (
            <>
              <span className="text-xs text-muted-foreground line-through">
                {formatINR(product.mrp)}
              </span>
              <span className="text-xs font-semibold text-emerald-600">
                {discount}% off
              </span>
            </>
          )}
        </div>

        {(() => {
          // `all_colors` merges the base product's own colour with every
          // colour added later as a variant, so this always reflects every
          // colour the product actually comes in (falls back to `colors`
          // for any product shape that predates this field).
          const swatchColors = product.all_colors?.length ? product.all_colors : product.colors;
          if (swatchColors.length === 0) return null;
          return (
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {swatchColors.map((c, i) => (
                <span
                  key={i}
                  title={c}
                  className="h-3.5 w-3.5 shrink-0 rounded-full border border-border/70"
                  style={{ backgroundColor: c.toLowerCase().replace(/\s+/g, '') }}
                />
              ))}
            </div>
          );
        })()}
      </div>
    </Link>
  );
}
