import { getServerSupabase } from './supabase-server';
import { fetchProductsServer, fetchCategoriesServer } from './products-api-server';
import { fetchPublicCollectionsServer, PublicCollectionRow } from './collections-api-server';
import { Product, CategoryRow } from './types';

export interface HomeBanner {
  image_url: string;
  link_url?: string;
}

export interface HomeData {
  products: Product[];
  categories: CategoryRow[];
  banner: HomeBanner | null;
  freeShippingThreshold: number | null;
  collections: PublicCollectionRow[];
}

async function fetchHomeBanner(): Promise<HomeBanner | null> {
  try {
    const supabase = getServerSupabase();
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'site_banner')
      .maybeSingle();
    const banner = data?.value as Partial<HomeBanner> | undefined;
    if (!banner?.image_url) return null;
    return { image_url: banner.image_url, link_url: banner.link_url };
  } catch {
    return null;
  }
}

async function fetchHomeFreeShippingThreshold(): Promise<number | null> {
  try {
    const supabase = getServerSupabase();
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'shipping')
      .maybeSingle();
    const threshold = (data?.value as { free_shipping_threshold?: number } | undefined)
      ?.free_shipping_threshold;
    return threshold || null;
  } catch {
    return null;
  }
}

/**
 * Everything the homepage needs — products, categories, the store banner,
 * the free-shipping threshold, and curated collections — fetched together
 * server-side in one Promise.all, instead of home-client.tsx firing 4
 * independent client-side useEffect fetches after hydration (which made
 * the page visibly load in pieces: banner, then collections, then
 * products, each popping in at a different moment). The page now arrives
 * with everything already rendered.
 */
export async function fetchHomeData(): Promise<HomeData> {
  const [products, categories, banner, freeShippingThreshold, collections] = await Promise.all([
    fetchProductsServer(),
    fetchCategoriesServer(),
    fetchHomeBanner(),
    fetchHomeFreeShippingThreshold(),
    fetchPublicCollectionsServer(),
  ]);

  return { products, categories, banner, freeShippingThreshold, collections };
}
