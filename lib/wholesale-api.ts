import { supabase } from './supabase';
import { WholesalePricingTier } from './types';

export async function fetchWholesalePricing(): Promise<WholesalePricingTier[]> {
  const { data, error } = await supabase
    .from('wholesale_pricing')
    .select('*')
    .order('product_id', { ascending: true })
    .order('min_quantity', { ascending: true });
  if (error) throw error;
  return (data ?? []) as WholesalePricingTier[];
}

export interface WholesaleTierInput {
  product_id: string;
  min_quantity: number;
  unit_price: number;
  label: string | null;
}

export async function createWholesaleTier(input: WholesaleTierInput) {
  const { error } = await supabase.from('wholesale_pricing').insert(input);
  if (error) throw error;
}

export async function updateWholesaleTier(id: string, input: WholesaleTierInput) {
  const { error } = await supabase.from('wholesale_pricing').update(input).eq('id', id);
  if (error) throw error;
}

export async function deleteWholesaleTier(id: string) {
  const { error } = await supabase.from('wholesale_pricing').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Given a quantity, returns the best (lowest) unit price the customer
 * qualifies for from a product's wholesale tiers, or null if none apply.
 * Used on the storefront to auto-apply bulk pricing in the cart/product page.
 */
export function bestWholesalePrice(
  tiers: WholesalePricingTier[],
  quantity: number
): number | null {
  const eligible = tiers.filter((t) => quantity >= t.min_quantity);
  if (eligible.length === 0) return null;
  return Math.min(...eligible.map((t) => t.unit_price));
}
