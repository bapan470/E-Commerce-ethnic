import { getSupabaseBrowser } from './supabase-browser';
import { getServerSupabase } from './supabase-server';
import { Product } from './types';

export interface VariantSize {
  id: string;
  size: string;
  stock_quantity: number;
  price_override: number | null;
  sku: string | null;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  color: string;
  /** Hex swatch colour (e.g. "#7A1F2B") picked from the colour library, or
   *  typed manually for a custom colour. Used to render a real colour dot
   *  on the storefront when the variant has no image yet. */
  color_hex: string | null;
  slug: string;
  images: string[];
  /** Optional short fabric/drape/try-on video for this colour. */
  video: string | null;
  price_override: number | null;
  meta_title: string | null;
  meta_description: string | null;
  is_default: boolean;
  sku: string | null;
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
  colorHex?: string | null;
  slug: string;
  images: string[];
  video?: string | null;
  priceOverride?: number | null;
  metaTitle?: string;
  metaDescription?: string;
  isDefault?: boolean;
  sku?: string | null;
  sizes: { size: string; stockQuantity: number; priceOverride?: number | null; sku?: string | null }[];
}): Promise<ProductVariant> {
  const supabase = getSupabaseBrowser();
  const { data: variant, error } = await supabase
    .from('product_variants')
    .insert({
      product_id: input.productId,
      color: input.color,
      color_hex: input.colorHex ?? null,
      slug: input.slug,
      images: input.images,
      video: input.video ?? null,
      price_override: input.priceOverride ?? null,
      meta_title: input.metaTitle ?? null,
      meta_description: input.metaDescription ?? null,
      is_default: input.isDefault ?? false,
      sku: input.sku ?? null,
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
        sku: s.sku ?? null,
      }))
    );
    if (sizeError) throw sizeError;
  }

  return variant as ProductVariant;
}

/** Admin: fetch every colour variant for a product together with its per-size stock. */
export async function fetchVariantsWithSizes(productId: string): Promise<VariantWithSizes[]> {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from('product_variants')
    .select('*, product_variant_sizes(*)')
    .eq('product_id', productId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => {
    const { product_variant_sizes, ...variant } = row;
    return { ...variant, sizes: (product_variant_sizes ?? []) as VariantSize[] } as VariantWithSizes;
  });
}

export async function updateVariant(
  id: string,
  input: Partial<{
    color: string;
    color_hex: string | null;
    slug: string;
    images: string[];
    video: string | null;
    price_override: number | null;
    meta_title: string | null;
    meta_description: string | null;
    is_default: boolean;
    sku: string | null;
  }>
): Promise<ProductVariant> {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from('product_variants')
    .update(input)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as ProductVariant;
}

/**
 * Marking a variant as the default unsets the flag on its siblings first,
 * since only one colour variant per product should show as default.
 */
export async function setDefaultVariant(productId: string, variantId: string): Promise<void> {
  const supabase = getSupabaseBrowser();
  const { error: clearErr } = await supabase
    .from('product_variants')
    .update({ is_default: false })
    .eq('product_id', productId);
  if (clearErr) throw clearErr;

  const { error } = await supabase
    .from('product_variants')
    .update({ is_default: true })
    .eq('id', variantId);
  if (error) throw error;
}

export async function deleteVariant(id: string): Promise<void> {
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.from('product_variants').delete().eq('id', id);
  if (error) throw error;
}

export async function addVariantSize(input: {
  variantId: string;
  size: string;
  stockQuantity: number;
  priceOverride?: number | null;
  sku?: string | null;
}): Promise<VariantSize> {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from('product_variant_sizes')
    .insert({
      variant_id: input.variantId,
      size: input.size,
      stock_quantity: input.stockQuantity,
      price_override: input.priceOverride ?? null,
      sku: input.sku ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as VariantSize;
}

export async function updateVariantSize(
  id: string,
  input: Partial<{ size: string; stock_quantity: number; price_override: number | null; sku: string | null }>
): Promise<VariantSize> {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from('product_variant_sizes')
    .update(input)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as VariantSize;
}

export async function deleteVariantSize(id: string): Promise<void> {
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.from('product_variant_sizes').delete().eq('id', id);
  if (error) throw error;
}

export async function uploadVariantImage(file: File): Promise<string> {
  const supabase = getSupabaseBrowser();
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `variants/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const { error } = await supabase.storage
    .from('product-images')
    .upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('product-images').getPublicUrl(path);
  return data.publicUrl;
}
