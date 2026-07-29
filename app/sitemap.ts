import { MetadataRoute } from 'next';
import { getServerSupabase } from '@/lib/supabase-server';
import { ProductRow, CategoryRow } from '@/lib/types';
import { LEGAL_PAGE_TITLES } from '@/lib/marketing-api';
import { fetchPublishedBlogPostsServer } from '@/lib/blog-api-server';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.aruhihandlooms.com';

// Without a `revalidate` value, Next.js treats this route as static and
// bakes it ONCE at build/deploy time -- so a new product/variant added in
// Admin would NOT show up in sitemap.xml until the next deployment, even
// though the product page itself is already live (see the 60s revalidate
// on product/category/shop pages). 3600s (1 hour) means new products get
// picked up automatically without requiring a redeploy, same idea as the
// force-dynamic fix on the merchant-feed route.
export const revalidate = 3600;

// Supabase/PostgREST caps unbounded selects at 1000 rows by default. As the
// catalog grows past that, a plain `.select()` would silently drop rows from
// the sitemap -- so we page through everything explicitly instead of trusting
// the default limit.
const PAGE_SIZE = 1000;

async function fetchAllRows<T>(
  table: string,
  columns: string,
  applyFilter?: (query: any) => any
): Promise<T[]> {
  const supabase = getServerSupabase();
  const rows: T[] = [];
  let from = 0;

  while (true) {
    let query = supabase.from(table).select(columns).range(from, from + PAGE_SIZE - 1);
    if (applyFilter) query = applyFilter(query);
    const { data, error } = await query;
    if (error) {
      console.error(`sitemap: failed to fetch ${table}`, error);
      break;
    }
    if (!data || data.length === 0) break;
    rows.push(...(data as T[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

// Turns a raw images array (which may hold relative storage paths) into
// absolute URLs, since Google's image sitemap extension requires full URLs.
function toAbsoluteImageUrls(images: string[] | null | undefined): string[] {
  if (!images || images.length === 0) return [];
  return images
    .filter((img): img is string => !!img)
    .map((img) =>
      img.startsWith('http://') || img.startsWith('https://')
        ? img
        : `${SITE_URL}${img.startsWith('/') ? '' : '/'}${img}`
    );
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, variants, blogPosts] = await Promise.all([
    fetchAllRows<Pick<ProductRow, 'slug' | 'updated_at' | 'images'> & { category_name: string }>(
      'products',
      'slug, updated_at, images, category_name',
      (q) => q.eq('approval_status', 'live')
    ),
    fetchAllRows<Pick<CategoryRow, 'slug' | 'name'>>('categories', 'slug, name'),
    fetchAllRows<{ slug: string; created_at: string; images: string[] | null }>(
      'product_variants',
      'slug, created_at, images'
    ),
    fetchPublishedBlogPostsServer(),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${SITE_URL}/shop`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
  ];

  // Only submit categories that currently have at least one live product --
  // an empty category page is noindex (see app/category/[slug]/page.tsx),
  // and listing a noindex URL in the sitemap just generates a confusing
  // "Submitted URL marked noindex" warning in Search Console. A category
  // rejoins the sitemap automatically on the next build/revalidation once
  // it has a product.
  const namesWithProducts = new Set(products.map((p) => p.category_name));
  const categoryPages: MetadataRoute.Sitemap = categories
    .filter((c) => namesWithProducts.has(c.name))
    .map((c) => ({
      url: `${SITE_URL}/category/${c.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));

  const blogPages: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/blog`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    ...blogPosts.map((p) => ({
      url: `${SITE_URL}/blog/${p.slug}`,
      lastModified: new Date(p.updated_at || p.published_at),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
  ];

  const legalPages: MetadataRoute.Sitemap = Object.keys(LEGAL_PAGE_TITLES).map((slug) => ({
    url: `${SITE_URL}/legal/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.2,
  }));

  const productPages: MetadataRoute.Sitemap = products.map((p) => {
    const images = toAbsoluteImageUrls(p.images);
    return {
      url: `${SITE_URL}/product/${p.slug}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
      ...(images.length > 0 ? { images } : {}),
    };
  });

  const variantPages: MetadataRoute.Sitemap = variants.map((v) => {
    const images = toAbsoluteImageUrls(v.images);
    return {
      url: `${SITE_URL}/product/${v.slug}`,
      lastModified: v.created_at ? new Date(v.created_at) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
      ...(images.length > 0 ? { images } : {}),
    };
  });

  return [
    ...staticPages,
    ...categoryPages,
    ...blogPages,
    ...legalPages,
    ...productPages,
    ...variantPages,
  ];
}
