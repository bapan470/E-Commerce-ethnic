import { getServerSupabase } from './supabase-server';
import { fetchProductsServer, fetchCategoriesServer } from './products-api-server';
import { fetchPublicCollectionsServer, PublicCollectionRow } from './collections-api-server';
import { Product, CategoryRow } from './types';
import { HomepageTile } from './homepage-tiles-api';

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
  tiles: HomepageTile[];
  collectionSlugById: Record<string, string>;
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

// Server-only read of the homepage grid tiles (Part 3b2) — deliberately
// does NOT reuse fetchActiveHomepageTiles from lib/homepage-tiles-api.ts,
// since that one goes through the browser-only client in lib/supabase.ts
// and isn't safe to call from a server component. Same "fail quiet"
// approach as fetchHomeBanner above: a tiles failure should never break
// the rest of the homepage.
async function fetchHomeTiles(): Promise<HomepageTile[]> {
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('homepage_tiles')
      .select('*')
      .eq('is_active', true)
      .order('position', { ascending: true });
    if (error) throw error;
    return (data ?? []) as HomepageTile[];
  } catch {
    return [];
  }
}

// id -> slug lookup for every active collection, used by the homepage
// grid to resolve link_type='collection' tiles to /collection/[slug]
// without shipping the whole collections payload to the client.
async function fetchCollectionSlugMap(): Promise<Record<string, string>> {
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('collections')
      .select('id, slug')
      .eq('is_active', true);
    if (error) throw error;
    const map: Record<string, string> = {};
    for (const row of data ?? []) {
      map[row.id as string] = row.slug as string;
    }
    return map;
  } catch {
    return {};
  }
}

/**
 * Everything the homepage needs — products, categories, the store banner,
 * the free-shipping threshold, curated collections, and the homepage grid
 * tiles (plus the collection id->slug map those tiles link through) —
 * fetched together server-side in one Promise.all, instead of
 * home-client.tsx firing independent client-side useEffect fetches after
 * hydration (which made the page visibly load in pieces: banner, then
 * collections, then products, each popping in at a different moment). The
 * page now arrives with everything already rendered.
 */
export async function fetchHomeData(): Promise<HomeData> {
  const [products, categories, banner, freeShippingThreshold, collections, tiles, collectionSlugById] =
    await Promise.all([
      fetchProductsServer(),
      fetchCategoriesServer(),
      fetchHomeBanner(),
      fetchHomeFreeShippingThreshold(),
      fetchPublicCollectionsServer(),
      fetchHomeTiles(),
      fetchCollectionSlugMap(),
    ]);

  return {
    products,
    categories,
    banner,
    freeShippingThreshold,
    collections,
    tiles,
    collectionSlugById,
  };
}
