import { Metadata } from 'next';
import { fetchProductBySlugServer } from '@/lib/products-api-server';
import { fetchVariantBySlug, VariantWithSizes } from '@/lib/variants-api';
import ProductDetail from './product-detail';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.aruhihandlooms.com';

type Params = { params: { slug: string } };

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
      title: 'Product not found | Aruhi Handlooms',
      description: 'The product you are looking for does not exist.',
      robots: { index: false, follow: true },
    };
  }

  const { product, variant } = resolved;
  const displayName = variant ? `${product.name} - ${variant.color}` : product.name;

  const title = variant?.meta_title || `${displayName} | Aruhi Handlooms`;
  const description =
    variant?.meta_description ||
    product.description ||
    `Buy ${displayName} - ${product.fabric} from ${product.origin}. Handwoven ethnic wear from Aruhi Handlooms.`;
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
      siteName: 'Aruhi Handlooms',
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

export default async function ProductPage({ params }: Params) {
  const resolved = await resolveSeoTarget(params.slug);
  const product = resolved?.product ?? null;
  const variant = resolved?.variant ?? null;

  const jsonLd = product
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: variant ? `${product.name} - ${variant.color}` : product.name,
        description: product.description,
        slug: params.slug,
        category: product.category,
        color: variant?.color || product.colors[0] || undefined,
        image:
          (variant?.images.length ? variant.images : product.images).length > 0
            ? variant?.images.length
              ? variant.images
              : product.images
            : undefined,
        sku: variant?.id || product.id,
        brand: {
          '@type': 'Brand',
          name: 'Aruhi Handlooms',
        },
        offers: {
          '@type': 'Offer',
          url: `${SITE_URL}/product/${params.slug}`,
          priceCurrency: 'INR',
          price: variant?.price_override ?? product.price,
          availability: product.inStock
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
          itemCondition: 'https://schema.org/NewCondition',
          seller: {
            '@type': 'Organization',
            name: 'Aruhi Handlooms',
          },
        },
        aggregateRating:
          product.reviews > 0
            ? {
                '@type': 'AggregateRating',
                ratingValue: product.rating,
                reviewCount: product.reviews,
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <ProductDetail />
    </>
  );
}
