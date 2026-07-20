'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ShoppingBag, Star } from 'lucide-react';
import { Product } from '@/lib/types';
import { formatINR, discountPct } from '@/lib/format';
import { useCart } from '@/lib/cart-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import WishlistButton from '@/components/wishlist-button';
import { blurDataURL } from '@/lib/utils';

export default function ProductCard({
  product,
  priority = false,
}: {
  product: Product;
  /** Set true for cards in the first visible row so their image gets
   *  preloaded instead of lazy-loaded — improves LCP on the shop/home grid. */
  priority?: boolean;
}) {
  const { addItem } = useCart();

  const quickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const size = product.sizes[0];
    addItem(product, size, 1);
  };

  const discount = discountPct(product.price, product.mrp);
  const img = product.images[0] || 'https://placehold.co/800x1000?text=No+Image';
  const hoverImg = product.images[1];
  const altText = `${product.name} - ${product.fabric} ${product.category} from ${product.origin}`;

  return (
    <Link
      href={`/product/${product.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-lg border border-border/60 bg-card product-card-hover"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-muted">
        <Image
          src={img}
          alt={altText}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          quality={78}
          priority={priority}
          loading={priority ? undefined : 'lazy'}
          placeholder="blur"
          blurDataURL={blurDataURL(32, 40)}
          className={`object-cover transition-opacity duration-300 ease-out ${
            hoverImg ? 'group-hover:opacity-0' : 'group-hover:scale-105 transition-transform duration-500'
          }`}
        />
        {/* Shopify-style hover swap: shows the second product photo on hover
            instead of a plain zoom, giving a peek at another angle without
            an extra click. Falls back to a simple scale zoom if there's
            only one image. Lazy — only loads once the card is in view. */}
        {hoverImg && (
          <Image
            src={hoverImg}
            alt={`${altText} - alternate view`}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            quality={70}
            loading="lazy"
            className="absolute inset-0 object-cover opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100"
          />
        )}
        <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {/* Admin toggles "Featured" per product in the dashboard — shown
              here as a Bestseller tag, so it updates the moment they flip it. */}
          {product.featured && (
            <Badge className="bg-emerald-600 text-white shadow-sm hover:bg-emerald-600">
              Bestseller
            </Badge>
          )}
          {discount > 0 && (
            <Badge className="bg-secondary text-secondary-foreground shadow-sm">
              {discount}% OFF
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
          aria-label="Add to cart"
        >
          <ShoppingBag className="h-4 w-4" />
          Add
        </Button>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {product.category}
        </p>
        <h3 className="line-clamp-1 font-serif text-sm font-semibold text-foreground">
          {product.name}
        </h3>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Star className="h-3 w-3 fill-secondary text-secondary" />
          <span>{product.rating.toFixed(1)}</span>
          <span>·</span>
          <span>{product.reviews} reviews</span>
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-serif text-base font-bold text-primary">
            {formatINR(product.price)}
          </span>
          {product.mrp && product.mrp > product.price && (
            <span className="text-xs text-muted-foreground line-through">
              {formatINR(product.mrp)}
            </span>
          )}
        </div>

        {product.colors.length > 0 && (
          <div className="mt-1 flex items-center gap-1">
            {product.colors.slice(0, 4).map((c, i) => (
              <span
                key={i}
                title={c}
                className="h-3.5 w-3.5 rounded-full border border-border/70"
                style={{ backgroundColor: c.toLowerCase().replace(/\s+/g, '') }}
              />
            ))}
            {product.colors.length > 4 && (
              <span className="text-[10px] text-muted-foreground">
                +{product.colors.length - 4}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
