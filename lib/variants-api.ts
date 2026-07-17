import { getSupabaseBrowser } from './supabase-browser';
import { getServerSupabase } from './supabase-server';
import { Product } from './types';

export interface VariantSize {
  id: string;
  size: string;
  stock_quantity: number;
  price_override: number | null;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  color: string;
  slug: string;
  images: string[];
  price_override: number | null;
  meta_title: string | null;
  meta_description: string | null;
  is_default: boolean;
  created_at: string;
}

export interface VariantWithSizes extends ProductVariant {
  sizes: VariantSize[];
}

/** All colour variants for a product, used to render swatch links on the PDP. */
export async function fetchVariantsForProduct(productId: string): Promise<ProductVariant[]> {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from('product_variants')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProductVariant[];
}

/**
 * Look up a variant by its own SEO slug and return it together with its
 * parent product and per-size stock. Used for /product/[slug] when the
 * slug doesn't match a base product (i.e. it's a colour-specific page).
 * Works on both client and server (pass server=true from a Server Component).
 */
export async function fetchVariantBySlug(
  slug: string,
  server = false
): Promise<{ variant: VariantWithSizes; product: Product } | null> {
  const supabase = server ? getServerSupabase() : getSupabaseBrowser();

  const { data: variant, error } = await supabase
    .from('product_variants')
    .select('*, product_variant_sizes(*), products(*)')
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw error;
  if (!variant) return null;

  const { products: productRow, product_variant_sizes, ...variantFields } = variant as any;
  if (!productRow) return null;

  const { mapRowToProduct } = server
    ? await import('./products-api-server')
    : await import('./products-api');

  return {
    variant: {
      ...(variantFields as ProductVariant),
      sizes: (product_variant_sizes ?? []) as VariantSize[],
    },
    product: mapRowToProduct(productRow),
  };
}

export async function createVariant(input: {
  productId: string;
  color: string;
  slug: string;
  images: string[];
  priceOverride?: number | null;
  metaTitle?: string;
  metaDescription?: string;
  isDefault?: boolean;
  sizes: { size: string; stockQuantity: number; priceOverride?: number | null }[];
}): Promise<ProductVariant> {
  const supabase = getSupabaseBrowser();
  const { data: variant, error } = await supabase
    .from('product_variants')
    .insert({
      product_id: input.productId,
      color: input.color,
      slug: input.slug,
      images: input.images,
      price_override: input.priceOverride ?? null,
      meta_title: input.metaTitle ?? null,
      meta_description: input.metaDescription ?? null,
      is_default: input.isDefault ?? false,
    })
    .select('*')
    .single();
  if (error) throw error;

  if (input.sizes.length > 0) {
    const { error: sizeError } = await supabase.from('product_variant_sizes').insert(
      input.sizes.map((s) => ({
        variant_id: variant.id,
        size: s.size,
        stock_quantity: s.stockQuantity,
        price_override: s.priceOverride ?? null,
      }))
    );
    if (sizeError) throw sizeError;
  }

  return variant as ProductVariant;
}

export async function deleteVariant(id: string): Promise<void> {
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.from('product_variants').delete().eq('id', id);
  if (error) throw error;
}
