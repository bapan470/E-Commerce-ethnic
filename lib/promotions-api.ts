export interface Promotion {
  id: string;
  name: string;
  offer_type: 'buy_x_get_y';
  buy_qty: number;
  get_qty: number;
  free_item_discount_percent: number;
  scope: 'all' | 'collection';
  collection_id: string | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at?: string;
}

export interface PromotionInput {
  name: string;
  offer_type: 'buy_x_get_y';
  buy_qty: number;
  get_qty: number;
  free_item_discount_percent: number;
  scope: 'all' | 'collection';
  collection_id: string | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

// ---------------------------------------------------------------------
// Admin management (Admin > Promotions tab)
// ---------------------------------------------------------------------

export async function fetchPromotions(): Promise<Promotion[]> {
  const res = await fetch('/api/admin/promotions');
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Failed to load promotions');
  return (body.promotions ?? []) as Promotion[];
}

async function adminPromotionRequest(url: string, options: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Request failed');
  return body;
}

export async function createPromotion(input: PromotionInput) {
  await adminPromotionRequest('/api/admin/promotions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updatePromotion(id: string, input: PromotionInput) {
  await adminPromotionRequest(`/api/admin/promotions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deletePromotion(id: string) {
  await adminPromotionRequest(`/api/admin/promotions/${id}`, { method: 'DELETE' });
}

export async function setPromotionActive(id: string, is_active: boolean) {
  await adminPromotionRequest(`/api/admin/promotions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active }),
  });
}

// NOTE: the storefront-facing fetchActivePromotions() (used by the cart
// to auto-apply BOGO discounts) is added in Part 2, alongside the cart
// engine that actually consumes it — kept out of this file for now so
// Part 1 stays admin-only, same as instructed.
