import { Metadata } from 'next';
import { fetchProductsServer } from '@/lib/products-api-server';
import { fetchCategoriesServer } from '@/lib/products-api-server';
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

export default async function ShopPage() {
  // If Supabase has a transient hiccup, fail soft (empty catalog + "no
  // products found" state) instead of throwing -- an unhandled throw here
  // would hit Next.js's default error screen, which is worse than the old
  // client-fetched page ever showed for the same failure.
  let products: Awaited<ReturnType<typeof fetchProductsServer>> = [];
  let categories: Awaited<ReturnType<typeof fetchCategoriesServer>> = [];
  try {
    [products, categories] = await Promise.all([
      fetchProductsServer(),
      fetchCategoriesServer(),
    ]);
  } catch (err) {
    console.error('Failed to load /shop data:', err);
  }

  return <ShopContent products={products} categories={categories} />;
}
