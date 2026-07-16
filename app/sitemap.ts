import { MetadataRoute } from 'next';
import { getServerSupabase } from '@/lib/supabase-server';
import { ProductRow, CategoryRow } from '@/lib/types';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://saaj.example';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = getServerSupabase();
  const [productsRes, categoriesRes] = await Promise.all([
    supabase.from('products').select('slug, updated_at'),
    supabase.from('categories').select('slug, name'),
  ]);

  const products = (productsRes.data ?? []) as Pick<ProductRow, 'slug' | 'updated_at'>[];
  const categories = (categoriesRes.data ?? []) as Pick<CategoryRow, 'slug' | 'name'>[];

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

  const productPages: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${SITE_URL}/product/${p.slug}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  return [...staticPages, ...categoryPages, ...productPages];
}
