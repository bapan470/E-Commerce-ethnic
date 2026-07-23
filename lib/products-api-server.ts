import { getServerSupabase } from './supabase-server';
import { Product, ProductRow, CategoryRow, Category } from './types';

// Phase 2: keep in sync with CUSTOMER_SAFE_PRODUCT_COLUMNS in
// products-api.ts. mapRowToProduct() already drops vendor_id since it's
// not on the Product type, but selecting it explicitly here too means
// it's never even fetched for SSR'd customer pages.
export const CUSTOMER_SAFE_PRODUCT_COLUMNS = [
  'id', 'name', 'slug', 'description', 'price', 'mrp',
  'category_id', 'category_name', 'fabric', 'origin', 'colors', 'sizes',
  'occasion', 'gender', 'age_group', 'material', 'pattern', 'images',
  'video_url', 'sku', 'highlights', 'stock_quantity', 'low_stock_threshold',
  'rating', 'reviews', 'featured', 'in_stock', 'created_at', 'updated_at',
].join(', ');

/** Pick the default colour variant off the embedded `product_variants` list
 *  (falls back to the first variant if none is explicitly marked default),
 *  so cards/listings can show and link to it instead of the base product. */
function resolveDefaultVariant(row: ProductRow) {
  const variants = row.product_variants ?? [];
  if (variants.length === 0) return null;
  return variants.find((v) => v.is_default) ?? variants[0];
}

/**
 * Every distinct colour this product comes in: the base product's own
 * `colors` entry plus every colour recorded on a `product_variants` row,
 * de-duplicated case-insensitively. Kept in sync with the identical helper
 * in lib/products-api.ts. A vendor's originally-listed colour only ever
 * lives on the `products` row itself -- never in `product_variants` -- so
 * without merging the two here, a product's card on shop/category pages
 * would only ever show colours added *after* the initial listing, silently
 * dropping the very first one.
 */
function resolveAllColors(row: ProductRow): string[] {
  const seen = new Set<string>();
  const all: string[] = [];
  for (const c of row.colors ?? []) {
    const key = c.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    all.push(c);
  }
  for (const v of row.product_variants ?? []) {
    const c = v.color;
    if (!c) continue;
    const key = c.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    all.push(c);
  }
  return all;
}

export function mapRowToProduct(row: ProductRow): Product {
  const defaultVariant = resolveDefaultVariant(row);
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    category: (row.category_name as Category) || 'Silk Sarees',
    price: row.price,
    mrp: row.mrp ?? undefined,
    description: row.description ?? '',
    fabric: row.fabric ?? '',
    origin: row.origin ?? '',
    colors: row.colors ?? [],
    all_colors: resolveAllColors(row),
    sizes: row.sizes ?? ['Free Size'],
    occasion: row.occasion ?? [],
    gender: row.gender || 'female',
    age_group: row.age_group || 'adult',
    material: row.material ?? null,
    pattern: row.pattern ?? null,
    images: row.images ?? [],
    video_url: row.video_url ?? null,
    sku: row.sku ?? null,
    highlights: row.highlights ?? null,
    default_variant_slug: defaultVariant?.slug ?? null,
    default_variant_image: defaultVariant?.images?.[0] ?? null,
    rating: Number(row.rating) || 4.5,
    reviews: row.reviews ?? 0,
    featured: row.featured,
    stock_quantity: row.stock_quantity,
    low_stock_threshold: row.low_stock_threshold ?? 5,
    inStock: row.in_stock,
    created_at: row.created_at,
  };
}

/**
 * Batch-attaches each product's vendor storefront collection (name + slug)
 * via the `product_collections` view -- kept in sync with the identical
 * helper in lib/products-api.ts. Avoids ever selecting `products.vendor_id`
 * in a customer-facing query. Products with no approved vendor simply get
 * `collection: null`.
 */
async function attachCollectionsServer(products: Product[]): Promise<Product[]> {
  if (products.length === 0) return products;
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('product_collections')
    .select('product_id, business_name, storefront_slug')
    .in('product_id', products.map((p) => p.id));
  if (error || !data) return products.map((p) => ({ ...p, collection: null }));
  const byId = new Map(
    data.map((row: any) => [row.product_id, { name: row.business_name, slug: row.storefront_slug }])
  );
  return products.map((p) => ({ ...p, collection: byId.get(p.id) ?? null }));
}

export async function fetchProductBySlugServer(slug: string): Promise<Product | null> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('products')
    .select(`${CUSTOMER_SAFE_PRODUCT_COLUMNS}, product_variants(slug, images, is_default, color)`)
    .eq('slug', slug)
    .eq('approval_status', 'live')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const product = mapRowToProduct(data as unknown as ProductRow);
  const [withCollection] = await attachCollectionsServer([product]);
  return withCollection;
}

export async function fetchProductsServer(): Promise<Product[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('products')
    .select(`${CUSTOMER_SAFE_PRODUCT_COLUMNS}, product_variants(slug, images, is_default, color)`)
    .eq('approval_status', 'live')
    .order('created_at', { ascending: false });
  if (error) throw error;
  const products = (data as unknown as ProductRow[]).map(mapRowToProduct);
  return attachCollectionsServer(products);
}

export async function fetchCategoriesServer(): Promise<CategoryRow[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as CategoryRow[];
}
