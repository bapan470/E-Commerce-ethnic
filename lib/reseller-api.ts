// ---------------------------------------------------------------------
// Reseller program — lets any logged-in customer (SAME account/email,
// no separate signup) resell products with their own margin. The store
// owner still packs & ships every order (dropship style); the reseller
// just places the order on behalf of their own end-customer and earns
// the difference between the base price and what they charged.
// ---------------------------------------------------------------------

export interface ResellerProfile {
  id: string;
  user_id: string;
  status: 'active' | 'suspended';
  default_margin_percent: number;
  business_name: string | null;
  created_at: string;
}

export interface ResellerEarnings {
  totalOrders: number;
  totalSales: number; // sum of what reseller's customers paid
  totalProfit: number; // reseller's earnings (sales - base cost)
  pendingOrders: number;
}

export interface ResellerOverview {
  profile: ResellerProfile | null;
  earnings: ResellerEarnings;
}

/** Fetches the current user's reseller profile (null if they haven't joined yet). */
export async function fetchMyResellerOverview(): Promise<ResellerOverview> {
  const res = await fetch('/api/reseller');
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to load reseller data');
  }
  return res.json();
}

/** Joins the reseller program using the SAME logged-in account. */
export async function joinResellerProgram(defaultMarginPercent = 20): Promise<ResellerProfile> {
  const res = await fetch('/api/reseller', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ default_margin_percent: defaultMarginPercent }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to join reseller program');
  }
  const body = await res.json();
  return body.profile as ResellerProfile;
}

/** Updates the reseller's default margin %. */
export async function updateResellerMargin(defaultMarginPercent: number): Promise<void> {
  const res = await fetch('/api/reseller', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ default_margin_percent: defaultMarginPercent }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to update margin');
  }
}

/** Given a base price and margin %, returns the price to charge the reseller's own customer. */
export function resellerSellingPrice(basePrice: number, marginPercent: number): number {
  return Math.round(basePrice * (1 + marginPercent / 100));
}

// ---------------------------------------------------------------------
// Placing orders on behalf of the reseller's own customers
// ---------------------------------------------------------------------

export interface ResellerOrderItemInput {
  product_id: string;
  quantity: number;
  size?: string | null;
}

export interface PlaceResellerOrderInput {
  items: ResellerOrderItemInput[];
  margin_percent: number;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  shipping_address: {
    address: string;
    address2?: string;
    city: string;
    state: string;
    pincode: string;
    country?: string;
  };
}

export async function placeResellerOrder(input: PlaceResellerOrderInput): Promise<{ id: string }> {
  const res = await fetch('/api/reseller/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to place order');
  }
  return res.json();
}

export interface ResellerOrderRow {
  id: string;
  items: any[];
  total_amount: number;
  reseller_base_cost: number;
  reseller_profit: number;
  reseller_margin_percent: number;
  status: string;
  customer_name: string | null;
  customer_phone: string | null;
  shipping_address: any;
  created_at: string;
}

export async function fetchMyResellerOrders(): Promise<ResellerOrderRow[]> {
  const res = await fetch('/api/reseller/orders');
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to load orders');
  }
  const body = await res.json();
  return body.orders as ResellerOrderRow[];
}

// ---------------------------------------------------------------------
// Admin (Admin > Resellers tab)
// ---------------------------------------------------------------------

export interface AdminResellerRow {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: 'active' | 'suspended';
  defaultMarginPercent: number;
  createdAt: string;
  totalOrders: number;
  totalSales: number;
  totalProfit: number;
}

export interface AdminResellersOverview {
  resellers: AdminResellerRow[];
  totalResellers: number;
  totalOrders: number;
  totalSales: number;
}

export async function fetchAdminResellersOverview(): Promise<AdminResellersOverview> {
  const res = await fetch('/api/admin/resellers');
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to load resellers');
  }
  return res.json();
}

export async function updateAdminResellerStatus(id: string, status: 'active' | 'suspended'): Promise<void> {
  const res = await fetch('/api/admin/resellers', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to update reseller');
  }
}
