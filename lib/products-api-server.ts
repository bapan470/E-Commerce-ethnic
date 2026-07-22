import { getServerSupabase } from './supabase-server';
import { Product, ProductRow, CategoryRow, Category } from './types';

// Phase 2: keep in sync with CUSTOMER_SAFE_PRODUCT_COLUMNS in
// products-api.ts. mapRowToProduct() already drops vendor_id since it's
// not on the Product type, but selecting it explicitly here too means
// it's never even fetched for SSR'd customer pages.
const CUSTOMER_SAFE_PRODUCT_COLUMNS = [
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

export async function fetchProductBySlugServer(slug: string): Promise<Product | null> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('products')
    .select(`${CUSTOMER_SAFE_PRODUCT_COLUMNS}, product_variants(slug, images, is_default)`)
    .eq('slug', slug)
    .eq('approval_status', 'live')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapRowToProduct(data as unknown as ProductRow);
}

export async function fetchProductsServer(): Promise<Product[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('products')
    .select(`${CUSTOMER_SAFE_PRODUCT_COLUMNS}, product_variants(slug, images, is_default)`)
    .eq('approval_status', 'live')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as ProductRow[]).map(mapRowToProduct);
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
