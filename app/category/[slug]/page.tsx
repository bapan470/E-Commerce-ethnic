import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { fetchCategoriesServer, fetchProductsServer } from '@/lib/products-api-server';
import ProductCard from '@/components/product-card';
import { safeJsonLd } from '@/lib/json-ld';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.aruhihandlooms.com';

// This page uses generateStaticParams(), so without a `revalidate` value
// Next.js caches it once at build time and NEVER regenerates it (revalidate:
// false is the default for statically-generated pages). That meant a product
// deleted from the admin panel kept showing up here on the category
// storefront page indefinitely -- because it was baked into that static
// HTML at build time -- while its own /product/[slug] page (rendered fresh,
// no generateStaticParams) correctly 404'd on click. ISR with a 60s window
// keeps this page nearly-static (cheap, fast) while making sure it drops
// deleted/changed products within a minute instead of only on the next
// deploy. Admin mutations also call revalidatePath() for an instant purge --
// see app/api/admin/products/[id]/route.ts -- this is just the safety net.
export const revalidate = 60;

type Params = { params: { slug: string } };

/**
 * Fallback intro copy, used only when the admin hasn't filled in the
 * category's own `description` field yet (Admin > Categories — that field
 * already existed, it just had no public page to render on until now).
 * Keeps every category page unique, indexable, and reasonably descriptive
 * out of the box; admins can override it any time with custom SEO copy.
 */
function fallbackIntro(name: string): string {
  return (
    `Explore our handpicked ${name} collection at AruhiHandlooms. Every piece is sourced ` +
    `directly from master weavers across India, blending traditional craftsmanship with ` +
    `designs made for everyday elegance and special occasions alike. Whether you're shopping ` +
    `for a wedding, festival, or gifting, our ${name} collection is curated for quality, ` +
    `comfort, and timeless style — with new arrivals added regularly. Each product page has ` +
    `detailed fabric, care, and sizing information so you can shop with confidence.`
  );
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const categories = await fetchCategoriesServer();
  const category = categories.find((c) => c.slug === params.slug);

  if (!category) {
    return {
      title: 'Category not found | AruhiHandlooms',
      robots: { index: false, follow: true },
    };
  }

  const description = (category.description || fallbackIntro(category.name)).slice(0, 160);
  const url = `${SITE_URL}/category/${category.slug}`;
  const title = `${category.name} | AruhiHandlooms`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'AruhiHandlooms',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
    },
  };
}

export async function generateStaticParams() {
  const categories = await fetchCategoriesServer();
  return categories.map((c) => ({ slug: c.slug }));
}

export default async function CategoryPage({ params }: Params) {
  const [categories, products] = await Promise.all([
    fetchCategoriesServer(),
    fetchProductsServer(),
  ]);

  const category = categories.find((c) => c.slug === params.slug);
  if (!category) notFound();

  const categoryProducts = products.filter((p) => p.category === category.name);
  const intro = category.description || fallbackIntro(category.name);
  const url = `${SITE_URL}/category/${category.slug}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: category.name,
    description: intro,
    url,
    ...(categoryProducts.length > 0
      ? {
          mainEntity: {
            '@type': 'ItemList',
            itemListElement: categoryProducts.slice(0, 24).map((p, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              url: `${SITE_URL}/product/${p.slug}`,
            })),
          },
        }
      : {}),
  };

  return (
    <div className="container-boutique py-8 pb-24 md:pb-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      <nav className="mb-4 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-primary">
          Home
        </Link>
        {' / '}
        <Link href="/categories" className="hover:text-primary">
          Categories
        </Link>
        {' / '}
        <span className="text-foreground">{category.name}</span>
      </nav>

      <h1 className="font-serif text-3xl font-bold text-primary sm:text-4xl">{category.name}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
        {intro}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {categoryProducts.length} {categoryProducts.length === 1 ? 'product' : 'products'}
      </p>

      {categoryProducts.length === 0 ? (
        <div className="mt-10 flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-20 text-center">
          <p className="font-serif text-lg font-semibold">No products yet</p>
          <p className="text-sm text-muted-foreground">
            Check back soon, or browse everything in Shop.
          </p>
          <Link href="/shop" className="mt-2 text-sm font-medium text-primary underline">
            Shop All
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {categoryProducts.map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 4} />
          ))}
        </div>
      )}
    </div>
  );
}
