import { MetadataRoute } from 'next';
import { getServerSupabase } from '@/lib/supabase-server';
import { ProductRow, CategoryRow } from '@/lib/types';
import { LEGAL_PAGE_TITLES } from '@/lib/marketing-api';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.aruhihandlooms.com';

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
  const [products, categories, variants] = await Promise.all([
    fetchAllRows<Pick<ProductRow, 'slug' | 'updated_at' | 'images'>>(
      'products',
      'slug, updated_at, images',
      (q) => q.eq('approval_status', 'live')
    ),
    fetchAllRows<Pick<CategoryRow, 'slug' | 'name'>>('categories', 'slug, name'),
    fetchAllRows<{ slug: string; created_at: string; images: string[] | null }>(
      'product_variants',
      'slug, created_at, images'
    ),
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
    {
      url: `${SITE_URL}/cart`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/checkout`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/admin`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.1,
    },
  ];

  const categoryPages: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${SITE_URL}/shop?category=${encodeURIComponent(c.name)}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

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

  return [...staticPages, ...categoryPages, ...legalPages, ...productPages, ...variantPages];
}
