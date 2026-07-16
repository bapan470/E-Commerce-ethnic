import { Metadata } from 'next';
import { fetchProductBySlugServer } from '@/lib/products-api-server';
import ProductDetail from './product-detail';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://saaj.example';

type Params = { params: { slug: string } };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const product = await fetchProductBySlugServer(params.slug);

  if (!product) {
    return {
      title: 'Product not found | Saaj Boutique',
      description: 'The product you are looking for does not exist.',
      robots: { index: false, follow: true },
    };
  }

  const title = `${product.name} | Saaj Boutique`;
  const description = product.description || `Buy ${product.name} - ${product.fabric} from ${product.origin}. Handwoven ethnic wear from Saaj Boutique.`;
  const url = `${SITE_URL}/product/${product.slug}`;
  const image = product.images[0] || 'https://images.pexels.com/photos/1191349/pexels-photo-1191349.jpeg?auto=compress&cs=tinysrgb&w=1200&h=630&fit=crop';

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
      siteName: 'Saaj Boutique',
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: product.name,
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
  const product = await fetchProductBySlugServer(params.slug);

  const jsonLd = product
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        description: product.description,
        slug: product.slug,
        category: product.category,
        image: product.images.length > 0 ? product.images : undefined,
        sku: product.id,
        brand: {
          '@type': 'Brand',
          name: 'Saaj Boutique',
        },
        offers: {
          '@type': 'Offer',
          url: `${SITE_URL}/product/${product.slug}`,
          priceCurrency: 'INR',
          price: product.price,
          availability: product.inStock
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
          itemCondition: 'https://schema.org/NewCondition',
          seller: {
            '@type': 'Organization',
            name: 'Saaj Boutique',
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
        material: product.fabric || undefined,
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
