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

/**
 * Every photo this product has anywhere: the base product's own `images`
 * plus every image on every `product_variants` row, de-duplicated. Powers
 * "search by photo" matching against ALL colour variants instead of just
 * the base product's first photo (see lib/image-search.ts).
 */
function resolveAllImages(row: ProductRow): string[] {
  const seen = new Set<string>();
  const all: string[] = [];
  for (const img of row.images ?? []) {
    if (!img || seen.has(img)) continue;
    seen.add(img);
    all.push(img);
  }
  for (const v of row.product_variants ?? []) {
    for (const img of v.images ?? []) {
      if (!img || seen.has(img)) continue;
      seen.add(img);
      all.push(img);
    }
  }
  return all;
}

/**
 * Every distinct colour this product comes in: the base product's own
 * `colors` entry plus every colour recorded on a `product_variants` row,
 * de-duplicated case-insensitively. A vendor's originally-listed colour
 * only ever lives on the `products` row itself -- never in
 * `product_variants` -- so without merging the two here, a product's card
 * on shop/category pages would only ever show colours added *after* the
 * initial listing, silently dropping the very first one.
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
    all_images: resolveAllImages(row),
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
 * via the `product_collections` view -- a safe, product_id-keyed lookup
 * that avoids ever selecting `products.vendor_id` in a customer-facing
 * query (see the comment on CUSTOMER_SAFE_PRODUCT_COLUMNS above). Mutates
 * nothing; returns new Product objects. Products with no approved vendor
 * (no matching row in the view) simply get `collection: null`.
 */
async function attachCollections(products: Product[]): Promise<Product[]> {
  if (products.length === 0) return products;
  const { data, error } = await supabase
    .from('product_collections')
    .select('product_id, business_name, storefront_slug')
    .in('product_id', products.map((p) => p.id));
  if (error || !data) return products.map((p) => ({ ...p, collection: null }));
  const bySlug = new Map(
    data.map((row: any) => [row.product_id, { name: row.business_name, slug: row.storefront_slug }])
  );
  return products.map((p) => ({ ...p, collection: bySlug.get(p.id) ?? null }));
}

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select(`${CUSTOMER_SAFE_PRODUCT_COLUMNS}, product_variants(slug, images, is_default, color)`)
    .eq('approval_status', 'live')
    .order('created_at', { ascending: false });
  if (error) throw error;
  const products = (data as unknown as ProductRow[]).map(mapRowToProduct);
  return attachCollections(products);
}

export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select(`${CUSTOMER_SAFE_PRODUCT_COLUMNS}, product_variants(slug, images, is_default, color)`)
    .eq('slug', slug)
    .eq('approval_status', 'live')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const product = mapRowToProduct(data as unknown as ProductRow);
  const [withCollection] = await attachCollections([product]);
  return withCollection;
}

/** Used by the checkout order-bump (settings store a product id, not a slug). */
export async function fetchProductById(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select(CUSTOMER_SAFE_PRODUCT_COLUMNS)
    .eq('id', id)
    .eq('approval_status', 'live')
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

// NOTE: categories INSERT/UPDATE/DELETE are locked to `service_role` by
// the 20260829040000 migration, so these now go through the admin API
// routes (server-side, service-role client) instead of writing directly
// from the browser with the anon key. SELECT (fetchCategories,
// countProductsInCategory below) stays on the anon client -- that's still
// public storefront data.
export async function createCategory(input: {
  name: string;
  slug: string;
  description?: string | null;
}): Promise<CategoryRow> {
  const res = await fetch('/api/admin/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Failed to create category');
  return json.category as CategoryRow;
}

export async function updateCategory(
  id: string,
  input: Partial<{ name: string; slug: string; description: string | null }>
): Promise<CategoryRow> {
  const res = await fetch(`/api/admin/categories/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Failed to update category');
  return json.category as CategoryRow;
}

export async function deleteCategory(id: string): Promise<void> {
  const res = await fetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || 'Failed to delete category');
  }
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

/**
 * Supabase/Postgrest errors are plain objects (never `instanceof Error`),
 * so `err instanceof Error ? err.message : 'Save failed'` in the admin
 * panel was always falling through to the generic fallback and hiding
 * the real constraint/RLS violation message. This pulls a readable
 * message out of any shape we might catch.
 */
export function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object') {
    const anyErr = err as { message?: unknown; error_description?: unknown; details?: unknown; hint?: unknown };
    if (typeof anyErr.message === 'string' && anyErr.message) return anyErr.message;
    if (typeof anyErr.error_description === 'string' && anyErr.error_description) return anyErr.error_description;
    if (typeof anyErr.details === 'string' && anyErr.details) return anyErr.details;
    if (typeof anyErr.hint === 'string' && anyErr.hint) return anyErr.hint;
  }
  if (typeof err === 'string' && err) return err;
  return fallback;
}

// NOTE: `products` INSERT/UPDATE/DELETE (for admin-owned catalog rows) are
// locked to `service_role` by the 20260829040000 migration, so admin
// create/update/delete now go through the admin API routes (server-side,
// service-role client) instead of writing directly from the browser with
// the anon key. Vendor-side create/update (own_insert_vendor_products /
// own_update_vendor_products) are unaffected and still go through
// lib/vendor-api.ts as before. SELECT stays on the anon client -- that's
// still public storefront data.
export async function createProduct(input: Partial<ProductRow>): Promise<Product> {
  const res = await fetch('/api/admin/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Failed to create product');
  return mapRowToProduct(json.product as ProductRow);
}

export async function updateProduct(
  id: string,
  input: Partial<ProductRow>
): Promise<Product> {
  const res = await fetch(`/api/admin/products/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Failed to update product');
  return mapRowToProduct(json.product as ProductRow);
}

export async function deleteProduct(id: string): Promise<void> {
  const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || 'Failed to delete product');
  }
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
