import { supabase } from '@/lib/supabase';

export type HomepageTileLinkType = 'collection' | 'promotion' | 'custom_url';

export interface HomepageTile {
  id: string;
  position: number;
  title: string;
  subtitle: string | null;
  badge_text: string | null;
  price_label: string | null;
  image_url: string | null;
  cta_label: string;
  link_type: HomepageTileLinkType;
  link_value: string | null;
  is_active: boolean;
  created_at?: string;
}

export interface HomepageTileInput {
  title: string;
  subtitle: string | null;
  badge_text: string | null;
  price_label: string | null;
  image_url: string | null;
  cta_label: string;
  link_type: HomepageTileLinkType;
  link_value: string | null;
  is_active: boolean;
}

// ---------------------------------------------------------------------
// Admin management (Admin > Homepage Tiles tab)
// ---------------------------------------------------------------------

export async function fetchHomepageTilesAdmin(): Promise<HomepageTile[]> {
  const res = await fetch('/api/admin/homepage-tiles');
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Failed to load homepage tiles');
  return (body.tiles ?? []) as HomepageTile[];
}

async function adminHomepageTileRequest(url: string, options: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Request failed');
  return body;
}

export async function createHomepageTile(input: HomepageTileInput) {
  await adminHomepageTileRequest('/api/admin/homepage-tiles', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateHomepageTile(id: string, input: Partial<HomepageTileInput>) {
  await adminHomepageTileRequest(`/api/admin/homepage-tiles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteHomepageTile(id: string) {
  await adminHomepageTileRequest(`/api/admin/homepage-tiles/${id}`, { method: 'DELETE' });
}

export async function setHomepageTileActive(id: string, is_active: boolean) {
  await adminHomepageTileRequest(`/api/admin/homepage-tiles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active }),
  });
}

// Persists a new order for all (or a subset of) tiles in one batch call —
// used by the up/down reorder buttons in the admin panel (Part 3b).
export async function reorderHomepageTiles(orderedIds: string[]) {
  await adminHomepageTileRequest('/api/admin/homepage-tiles/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ orderedIds }),
  });
}

// Uploads a homepage-tile image straight to Supabase Storage from the
// browser, the same way product photos are uploaded (lib/products-api.ts
// uploadProductImage) — reuses the existing public "product-images"
// bucket so no new bucket/migration is needed just for tiles.
export async function uploadHomepageTileImage(file: File, seoName?: string): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const slug = (seoName || 'homepage-tile')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const path = `tiles/${slug ? `${slug}-` : ''}${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const { error } = await supabase.storage
    .from('product-images')
    .upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('product-images').getPublicUrl(path);
  return data.publicUrl;
}

// ---------------------------------------------------------------------
// Storefront (public) — used by the homepage grid (Part 3b).
// ---------------------------------------------------------------------

export async function fetchActiveHomepageTiles(): Promise<HomepageTile[]> {
  try {
    const { data, error } = await supabase
      .from('homepage_tiles')
      .select('*')
      .eq('is_active', true)
      .order('position', { ascending: true });
    if (error) throw error;
    return (data ?? []) as HomepageTile[];
  } catch {
    // A homepage render should never break because tiles failed to
    // load — same "fail quiet" approach as fetchHomeBanner in
    // lib/home-data-server.ts.
    return [];
  }
}
