import { getServerSupabase } from './supabase-server';
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
    gender: row.gender || 'female',
    age_group: row.age_group || 'adult',
    material: row.material ?? null,
    pattern: row.pattern ?? null,
    images: row.images ?? [],
    video_url: row.video_url ?? null,
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
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapRowToProduct(data as ProductRow);
}

export async function fetchProductsServer(): Promise<Product[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as ProductRow[]).map(mapRowToProduct);
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
