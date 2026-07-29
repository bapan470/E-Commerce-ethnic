import { Metadata } from 'next';
import { ProductsProvider } from '@/lib/cart-context';
import { fetchProductBySlugServer } from '@/lib/products-api-server';
import { fetchVariantBySlug, VariantWithSizes } from '@/lib/variants-api';
import { safeJsonLd } from '@/lib/json-ld';
import { fetchFulfillmentSettings } from '@/lib/marketing-api';
import { fetchShippingSettings } from '@/lib/pincode-api';
import { generateVariantSeoContent } from '@/lib/variant-seo-content';
import { getVariantDisplayName } from '@/lib/variant-display-name';
import ProductDetail from './product-detail';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.aruhihandlooms.com';

// Safety net alongside the category page's identical fix (see the comment
// there): without a `revalidate` value, once a product page is rendered and
// cached it can be served stale indefinitely. 60s keeps this in sync with
// admin edits/deletes even if the on-demand revalidatePath() call in
// app/api/admin/products/[id]/route.ts is ever missed (e.g. a direct DB
// edit, or a vendor-side approval-status change).
export const revalidate = 60;

type Params = { params: { slug: string }; searchParams?: { size?: string } };

/**
 * Resolves either a base product slug or an independent colour-variant
 * slug, returning enough info to build variant-specific SEO metadata.
 * Each variant gets its own title/description/canonical/OG image so it
 * can rank independently in search (e.g. "Red Banarasi Silk Saree" vs
 * "Blue Banarasi Silk Saree" as two distinct indexable pages).
 */
async function resolveSeoTarget(slug: string) {
  const product = await fetchProductBySlugServer(slug);
  if (product) return { product, variant: null as VariantWithSizes | null };

  const variantResult = await fetchVariantBySlug(slug, true);
  if (!variantResult) return null;
  return { product: variantResult.product, variant: variantResult.variant };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const resolved = await resolveSeoTarget(params.slug);

  if (!resolved) {
    return {
      title: 'Product not found | AruhiHandlooms',
      description: 'The product you are looking for does not exist.',
      robots: { index: false, follow: true },
    };
  }

  const { product, variant } = resolved;
  // BUG FIX: this used to just append " - {colour}" onto product.name,
  // which duplicates the colour when it's already baked into the base
  // name (e.g. "Maroon Handloom Rayon Kurti with Palazzo - Steel Blue" --
  // both colours in one title). getVariantDisplayName swaps the base
  // product's own colour for the variant's instead. See
  // lib/variant-display-name.ts.
  const displayName = variant
    ? getVariantDisplayName(product?.name || '', product?.colors?.[0], variant.color)
    : product?.name || '';

  // BUG FIX: this used to fall back to `product.description` for every
  // colour variant that had no meta_description of its own — meaning every
  // colour of a product could ship the exact same <meta name="description">,
  // which reads as duplicate content to Google (a likely reason most
  // colour-variant URLs sat stuck as "Discovered - currently not indexed").
  // For a variant page, generate colour-specific fallback copy instead of
  // ever reusing the shared base-product description.
  const variantSeoFallback = variant
    ? generateVariantSeoContent({
        productName: product.name,
        fabric: product.fabric,
        category: product.category,
        occasion: product.occasion,
        color: variant.color,
      })
    : null;

  const title = variant?.meta_title || variantSeoFallback?.metaTitle || `${displayName} | AruhiHandlooms`;
  const description =
    variant?.meta_description ||
    variantSeoFallback?.metaDescription ||
    product.description ||
    `Buy ${displayName} - ${product.fabric} from ${product.origin}. Handwoven ethnic wear from AruhiHandlooms.`;
  const url = `${SITE_URL}/product/${params.slug}`;
  const images = variant?.images.length ? variant.images : product.images;
  const image = images[0] || 'https://images.pexels.com/photos/1191349/pexels-photo-1191349.jpeg?auto=compress&cs=tinysrgb&w=1200&h=630&fit=crop';

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: 'AruhiHandlooms',
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: displayName,
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
      },
    },
  };
}

export default async function ProductPage({ params, searchParams }: Params) {
  const resolved = await resolveSeoTarget(params.slug);
  const product = resolved?.product ?? null;
  const variant = resolved?.variant ?? null;

  // If this request came from a Merchant Center feed link (which appends
  // ?size=XL for products with per-size pricing -- see
  // app/api/merchant-feed/route.ts), resolve that exact size's price so
  // the structured-data <Offer> below matches what was advertised for it,
  // not just the colour's default price. Falls back to the colour/product
  // price when there's no ?size=, no matching size, or no override for it.
  const sizeParam = searchParams?.size?.trim();
  const matchedSize = sizeParam ? variant?.sizes.find((s) => s.size === sizeParam) : undefined;
  const offerPrice = matchedSize?.price_override ?? variant?.price_override ?? product?.price ?? 0;

  // Same source of truth as app/api/merchant-feed/route.ts (Admin >
  // Marketing > Shipping & Returns Timing) -- keeping this schema in sync
  // with the feed avoids a shipping/returns misrepresentation mismatch
  // between what's declared on-page vs to Google Merchant Center.
  const [fulfillment, shipping] = product
    ? await Promise.all([fetchFulfillmentSettings(), fetchShippingSettings()])
    : [null, null];

  // Same duplicate-content concern as generateMetadata() above -- a
  // variant's structured-data description shouldn't just repeat the base
  // product's shared text either.
  const jsonLdDescription = variant
    ? variant.meta_description ||
      [product?.description, variant.style_note].filter(Boolean).join(' ') ||
      product?.description
    : product?.description;

  // Same colour-correct name as generateMetadata() above (this is a
  // separate function so it needs its own copy) -- avoids the base
  // product's own colour and the variant's colour both ending up in the
  // structured-data name.
  const displayName = product
    ? variant
      ? getVariantDisplayName(product.name, product.colors?.[0], variant.color)
      : product.name
    : '';

  const jsonLd = product
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: displayName,
        description: jsonLdDescription,
        slug: params.slug,
        category: product.category,
        color: variant?.color || product.colors[0] || undefined,
        image:
          (variant?.images.length ? variant.images : product.images).length > 0
            ? variant?.images.length
              ? variant.images
              : product.images
            : undefined,
        sku: variant?.sku || product.sku || variant?.id || product.id,
        brand: {
          '@type': 'Brand',
          name: 'AruhiHandlooms',
        },
        offers: {
          '@type': 'Offer',
          url: `${SITE_URL}/product/${params.slug}${sizeParam ? `?size=${encodeURIComponent(sizeParam)}` : ''}`,
          priceCurrency: 'INR',
          price: offerPrice,
          availability:
            (matchedSize ? matchedSize.stock_quantity > 0 : product.inStock)
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
          itemCondition: 'https://schema.org/NewCondition',
          seller: {
            '@type': 'Organization',
            name: 'AruhiHandlooms',
          },
          shippingDetails: fulfillment && shipping
            ? {
                '@type': 'OfferShippingDetails',
                shippingRate: {
                  '@type': 'MonetaryAmount',
                  value: shipping.flat_rate,
                  currency: 'INR',
                },
                shippingDestination: {
                  '@type': 'DefinedRegion',
                  addressCountry: 'IN',
                },
                deliveryTime: {
                  '@type': 'ShippingDeliveryTime',
                  handlingTime: {
                    '@type': 'QuantitativeValue',
                    minValue: fulfillment.dispatch_days_min,
                    maxValue: fulfillment.dispatch_days_max,
                    unitCode: 'DAY',
                  },
                  transitTime: {
                    '@type': 'QuantitativeValue',
                    minValue: fulfillment.delivery_metro_min,
                    maxValue: fulfillment.delivery_remote_max,
                    unitCode: 'DAY',
                  },
                },
              }
            : undefined,
          hasMerchantReturnPolicy: fulfillment
            ? {
                '@type': 'MerchantReturnPolicy',
                applicableCountry: 'IN',
                returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
                merchantReturnDays: fulfillment.return_window_days,
                returnMethod: 'https://schema.org/ReturnByMail',
                returnFees: 'https://schema.org/FreeReturn',
              }
            : undefined,
        },
        aggregateRating:
          (variant?.reviews ?? product.reviews) > 0
            ? {
                '@type': 'AggregateRating',
                ratingValue: variant?.rating ?? product.rating,
                reviewCount: variant?.reviews ?? product.reviews,
                bestRating: 5,
                worstRating: 1,
              }
            : undefined,
        material: product.material || product.fabric || undefined,
        pattern: product.pattern || undefined,
        productionDate: product.created_at,
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
        />
      )}
      <ProductsProvider>
        <ProductDetail />
      </ProductsProvider>
    </>
  );
}
