import { Product } from './types';
import { getVariantDisplayName } from './variant-display-name';

/**
 * Expands each product into one card per colour it comes in — its own
 * base colour, plus every `product_variants` row — instead of folding
 * them into swatch dots on a single card. A product with 7 colours turns
 * into 7 separate cards in the grid, each linking straight to that exact
 * colour's own product page.
 *
 * Mirrors exactly how the product-detail page represents a variant as a
 * `Product` (see the `useMemo` merging `variant` onto `baseProduct` in
 * app/product/[slug]/product-detail.tsx): same `id`, only `slug`,
 * `colors`, and `images` swapped to that colour's own. Keeping `id`
 * unchanged means Add-to-Bag / wishlist / cart-line-matching (which all
 * key off `product.id` + `colors[0]`, see `itemColor` in
 * lib/cart-context.tsx) keep working exactly as they do from the PDP —
 * each colour still lands in its own cart line, and the wishlist heart
 * still refers to the same underlying product record.
 *
 * Cards render via the ordinary <ProductCard>, which already hides its
 * own swatch-dot row when a card has nothing left to switch between
 * (`variant_list` cleared to `[]` below) — so an exploded card shows
 * just its own photo, no redundant dots for colours already shown as
 * separate cards.
 */
export function expandProductVariants(products: Product[]): Product[] {
  const expanded: Product[] = [];
  for (const product of products) {
    const baseColor = (product.colors?.[0] ?? '').trim();
    const variants = product.variant_list ?? [];
    if (variants.length === 0) {
      expanded.push(product);
      continue;
    }
    // The base colour's own card, unchanged — same as today.
    expanded.push(product);
    const seen = new Set([baseColor.toLowerCase()]);
    for (const v of variants) {
      const key = v.color.trim().toLowerCase();
      if (!key || seen.has(key)) continue; // skip the base colour re-added as a variant row
      seen.add(key);
      expanded.push({
        ...product,
        slug: v.slug,
        name: getVariantDisplayName(product.name, baseColor, v.color),
        colors: [v.color],
        all_colors: [v.color],
        images: v.image ? [v.image, ...product.images.slice(1)] : product.images,
        default_variant_slug: undefined,
        default_variant_image: undefined,
        default_variant_color: undefined,
        variant_list: [],
      });
    }
  }
  return expanded;
}
