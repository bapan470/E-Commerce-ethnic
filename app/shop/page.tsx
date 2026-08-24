import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { fetchProductsServer } from '@/lib/products-api-server';
import { fetchCategoriesServer } from '@/lib/products-api-server';
import { fetchPopularityRankServer } from '@/lib/popularity-rank-server';
import ShopContent from './shop-content';

// Same reasoning as app/category/[slug]/page.tsx: this page has no
// generateStaticParams so it's dynamically rendered per-request by default,
// but `revalidate` still caches the underlying fetch/data for 60s at the
// route level, so most visits don't hit Supabase at all. Admin mutations
// call revalidatePath('/shop') for an instant purge when a product changes
// (see app/api/admin/products/[id]/route.ts) -- this is just the safety net.
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Shop All Sarees & Ethnic Wear | AruhiHandlooms',
  description:
    'Browse our full collection of sarees and ethnic wear, sourced directly from master weavers across India.',
};

export default async function ShopPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // Text search now lives at its own URL (/search?q=...) instead of
  // /shop?q=... -- /shop is the pure category/filter browsing page. Any
  // old links, bookmarks, or shares still using /shop?q=... get sent
  // straight to /search with every other param (sort, category, etc.)
  // carried over untouched, so nothing that was shared before this change
  // breaks.
  if (searchParams?.q) {
    const forwarded = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) value.forEach((v) => forwarded.append(key, v));
      else forwarded.append(key, value);
    }
    redirect(`/search?${forwarded.toString()}`);
  }

  // If Supabase has a transient hiccup, fail soft (empty catalog + "no
  // products found" state) instead of throwing -- an unhandled throw here
  // would hit Next.js's default error screen, which is worse than the old
  // client-fetched page ever showed for the same failure.
  let products: Awaited<ReturnType<typeof fetchProductsServer>> = [];
  let categories: Awaited<ReturnType<typeof fetchCategoriesServer>> = [];
  let initialPopularityRank: Map<string, number> = new Map();
  try {
    [products, categories, initialPopularityRank] = await Promise.all([
      fetchProductsServer(),
      fetchCategoriesServer(),
      fetchPopularityRankServer(),
    ]);
  } catch (err) {
    console.error('Failed to load /shop data:', err);
  }

  return <ShopContent products={products} categories={categories} initialPopularityRank={initialPopularityRank} />;
}
