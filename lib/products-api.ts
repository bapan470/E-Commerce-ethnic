'use client';

import { supabase } from './supabase';
import { Product, ProductRow, CategoryRow, Category } from './types';

// ---------------------------------------------------------------------
// Phase 2 (vendor listings): `products` now also carries vendor_id,
// barcode, approval_status, vendor_expected_price, ai_suggested_price
// and final_price — all internal-only (admin / order-processing).
// These functions run in the BROWSER, so an explicit column list here
// isn't just tidy: it's the difference between the raw network
// response never containing vendor_id at all, vs. it briefly existing
// in the page's network tab before mapRowToProduct() below discards
// it. Never widen this back to select('*') for customer-facing reads.
// ---------------------------------------------------------------------
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

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select(`${CUSTOMER_SAFE_PRODUCT_COLUMNS}, product_variants(slug, images, is_default)`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as ProductRow[]).map(mapRowToProduct);
}

export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select(`${CUSTOMER_SAFE_PRODUCT_COLUMNS}, product_variants(slug, images, is_default)`)
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapRowToProduct(data as unknown as ProductRow);
}

/** Used by the checkout order-bump (settings store a product id, not a slug). */
export async function fetchProductById(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select(CUSTOMER_SAFE_PRODUCT_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapRowToProduct(data as unknown as ProductRow);
}

export async function fetchCategories(): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as CategoryRow[];
}

export async function createCategory(input: {
  name: string;
  slug: string;
  description?: string | null;
}): Promise<CategoryRow> {
  const { data, error } = await supabase
    .from('categories')
    .insert({
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as CategoryRow;
}

export async function updateCategory(
  id: string,
  input: Partial<{ name: string; slug: string; description: string | null }>
): Promise<CategoryRow> {
  const { data, error } = await supabase
    .from('categories')
    .update(input)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as CategoryRow;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
}

/** How many products currently reference this category — shown before delete. */
export async function countProductsInCategory(categoryId: string): Promise<number> {
  const { count, error } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', categoryId);
  if (error) throw error;
  return count ?? 0;
}

export async function createProduct(input: Partial<ProductRow>): Promise<Product> {
  const payload = {
    name: input.name,
    slug: input.slug,
    description: input.description,
    price: input.price,
    mrp: input.mrp,
    category_id: input.category_id,
    category_name: input.category_name,
    fabric: input.fabric,
    origin: input.origin,
    colors: input.colors ?? [],
    sizes: input.sizes ?? ['Free Size'],
    occasion: input.occasion ?? [],
    gender: input.gender ?? 'female',
    age_group: input.age_group ?? 'adult',
    material: input.material ?? null,
    pattern: input.pattern ?? null,
    images: input.images ?? [],
    video_url: input.video_url ?? null,
    sku: input.sku ?? null,
    highlights: input.highlights ?? {},
    stock_quantity: input.stock_quantity ?? 0,
    low_stock_threshold: input.low_stock_threshold ?? 5,
    rating: input.rating ?? 4.5,
    reviews: input.reviews ?? 0,
    featured: input.featured ?? false,
    in_stock: input.in_stock ?? true,
  };
  const { data, error } = await supabase
    .from('products')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return mapRowToProduct(data as ProductRow);
}

export async function updateProduct(
  id: string,
  input: Partial<ProductRow>
): Promise<Product> {
  const payload: Record<string, unknown> = {};
  for (const key of [
    'name', 'slug', 'description', 'price', 'mrp', 'category_id',
    'category_name', 'fabric', 'origin', 'colors', 'sizes', 'occasion', 'images',
    'video_url', 'gender', 'age_group', 'material', 'pattern', 'sku', 'highlights',
    'stock_quantity', 'low_stock_threshold', 'rating', 'reviews', 'featured', 'in_stock',
  ]) {
    if (input[key as keyof ProductRow] !== undefined) {
      payload[key] = input[key as keyof ProductRow];
    }
  }
  const { data, error } = await supabase
    .from('products')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapRowToProduct(data as ProductRow);
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}

export async function uploadProductImage(file: File, seoName?: string): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  // Slugify the product name (if we have one yet) into the filename itself,
  // e.g. "womens-traditional-bengal-solid-saree-....jpg" instead of a bare
  // random string or a leftover upload name like "whatsapp-image-....jpg".
  const slug = (seoName || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const path = `${slug ? `${slug}-` : ''}${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const { error } = await supabase.storage
    .from('product-images')
    .upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('product-images').getPublicUrl(path);
  return data.publicUrl;
}
