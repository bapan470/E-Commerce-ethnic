'use client';

import { supabase } from './supabase';
import { Product, ProductRow, CategoryRow, Category } from './types';

export function mapRowToProduct(row: ProductRow): Product {
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
    images: row.images ?? [],
    rating: Number(row.rating) || 4.5,
    reviews: row.reviews ?? 0,
    featured: row.featured,
    stock_quantity: row.stock_quantity,
    inStock: row.in_stock,
    created_at: row.created_at,
  };
}

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as ProductRow[]).map(mapRowToProduct);
}

export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapRowToProduct(data as ProductRow);
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
    images: input.images ?? [],
    stock_quantity: input.stock_quantity ?? 0,
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
    'stock_quantity', 'rating', 'reviews', 'featured', 'in_stock',
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

export async function uploadProductImage(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const { error } = await supabase.storage
    .from('product-images')
    .upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('product-images').getPublicUrl(path);
  return data.publicUrl;
}
